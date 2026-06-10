'use client'

/**
 * The sky behind the room — a GPU aurora/ember field driven by the live
 * solstice ratio. It uses the same sky/sun colors the rest of the game derives
 * (so it never drifts from the CSS gradient), warms toward the sun at noon and
 * bleeds to embers as the light dies, and tightens cold with suspicion.
 *
 * Sits below <Scene>, which paints the room over it, so it reads as atmosphere
 * rather than spectacle. Falls back silently to the parent's CSS sky gradient
 * when WebGL is unavailable, and freezes to a single frame under reduced motion.
 */

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

type Props = {
  progress: number // 1 (noon) -> 0 (dark)
  suspicion: number // 0 -> 1
  skyTop: string
  skyBot: string
  sunCol: string
}

function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uProgress;
uniform float uSuspicion;
uniform vec3 uSkyTop;
uniform vec3 uSkyBot;
uniform vec3 uSun;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float t = uTime;

  // base vertical sky, exactly the CSS gradient
  vec3 col = mix(uSkyBot, uSkyTop, uv.y);

  // slow aurora ribbons drifting up the upper sky, brighter near noon
  float ribbon = fbm(vec2(uv.x * 2.5 + t * 0.05, uv.y * 3.0 - t * 0.08));
  float band = smoothstep(0.35, 0.78, ribbon) * smoothstep(0.0, 0.55, uv.y) * (0.4 + 0.6 * uProgress);
  col = mix(col, uSun, band * 0.32);

  // sun glow low on the horizon, fades as the day dies
  float d = distance(uv, vec2(0.5, 0.32));
  float glow = exp(-d * d * 8.0) * (0.45 + 0.7 * uProgress);
  col += uSun * glow * 0.55;

  // embers in the dusk: faint warm specks when the light is low
  float dusk = 1.0 - uProgress;
  float ember = fbm(vec2(uv.x * 8.0, uv.y * 8.0 - t * 0.3));
  col = mix(col, uSun * 0.85 + vec3(0.12, 0.02, 0.0), smoothstep(0.72, 0.96, ember) * dusk * 0.22);

  // suspicion creeps cold from the edges
  float edge = distance(uv, vec2(0.5)) * 1.4;
  col = mix(col, col * vec3(0.7, 0.72, 0.86), clamp(uSuspicion, 0.0, 1.0) * edge * 0.4);

  gl_FragColor = vec4(col, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export default function ShaderBackground({ progress, suspicion, skyTop, skyBot, sunCol }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  // latest game values, read each frame without re-initializing GL
  const stateRef = useRef({ progress, suspicion, skyTop, skyBot, sunCol })
  stateRef.current = { progress, suspicion, skyTop, skyBot, sunCol }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return // CSS sky gradient on <main> remains as fallback

    const vert = compile(gl, gl.VERTEX_SHADER, VERT)
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vert || !frag) return
    const prog = gl.createProgram()
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.useProgram(prog)

    const u = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      progress: gl.getUniformLocation(prog, 'uProgress'),
      suspicion: gl.getUniformLocation(prog, 'uSuspicion'),
      skyTop: gl.getUniformLocation(prog, 'uSkyTop'),
      skyBot: gl.getUniformLocation(prog, 'uSkyBot'),
      sun: gl.getUniformLocation(prog, 'uSun'),
    }

    let raf = 0
    let start = 0
    let running = true

    const draw = (timeSeconds: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.floor(canvas.clientWidth * dpr)
      const h = Math.floor(canvas.clientHeight * dpr)
      if (w === 0 || h === 0) return
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      const s = stateRef.current
      gl.uniform2f(u.res, w, h)
      gl.uniform1f(u.time, timeSeconds)
      gl.uniform1f(u.progress, s.progress)
      gl.uniform1f(u.suspicion, s.suspicion)
      gl.uniform3fv(u.skyTop, hexToRgb01(s.skyTop))
      gl.uniform3fv(u.skyBot, hexToRgb01(s.skyBot))
      gl.uniform3fv(u.sun, hexToRgb01(s.sunCol))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    if (reduce) {
      // single settled frame, no animation loop
      draw(8)
    } else {
      const loop = (now: number) => {
        if (!running) return
        if (!start) start = now
        draw((now - start) / 1000)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    // pause when tab hidden (battery / GPU)
    const onVis = () => {
      if (document.hidden) {
        running = false
        if (raf) cancelAnimationFrame(raf)
      } else if (!reduce && !running) {
        running = true
        start = 0
        raf = requestAnimationFrame((now) => {
          start = now
          const loop = (n: number) => {
            if (!running) return
            draw((n - start) / 1000)
            raf = requestAnimationFrame(loop)
          }
          raf = requestAnimationFrame(loop)
        })
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [reduce])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 h-full w-full"
    />
  )
}
