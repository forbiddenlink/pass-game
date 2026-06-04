'use client';

/**
 * The interrogation room — a CSS/SVG scene behind the play surface.
 * A barred window where the solstice sun sets (the daylight source + title
 * metaphor, so it's the hero), a swinging desk lamp that stays the last warm
 * thing as the day dies, the interrogator a silhouette across the table, a
 * vignette that closes in as the LIGHT fails (and tightens further with doubt),
 * and a little film grain. Driven by the live daylight ratio + suspicion.
 */
const LAMP = '#f4b258'; // fixed warm — the last warmth, never desaturates

export default function Scene({
  r, suspicion, skyTop, skyBot, sunCol,
}: { r: number; suspicion: number; skyTop: string; skyBot: string; sunCol: string }) {
  const lampGlow = 0.5 + (1 - r) * 0.5;
  const vignette = Math.min(0.86, 0.3 + (1 - r) * 0.42 + suspicion * 0.22); // the room dies with the light
  const swaySpeed = 8 - suspicion * 4;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      {/* barred window — the hero. iron bars, a hard sun disc with bloom, bars shadowing in. */}
      <div className="absolute right-[6%] top-[9%] h-[42vmin] w-[30vmin] overflow-hidden rounded-[2px] shadow-[0_0_70px_rgba(0,0,0,0.7)]"
        style={{ background: `linear-gradient(${skyTop}, ${skyBot})` }}>
        <div className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            top: `${(1 - r) * 56 + 8}%`,
            height: '13vmin', width: '13vmin',
            background: `radial-gradient(circle, #fff2cf 0%, ${sunCol} 38%, ${skyBot} 64%, transparent 72%)`,
            boxShadow: `0 0 9vmin 2vmin ${sunCol}`,
            opacity: Math.max(0, Math.min(1, r * 1.4)),
          }} />
        {/* iron bars + their cast shadow */}
        {[28, 50, 72].map((x) => (
          <div key={x} className="absolute inset-y-0" style={{ left: `${x}%`, width: '3px', background: '#05040a', boxShadow: '3px 0 8px rgba(0,0,0,0.5)' }} />
        ))}
        <div className="absolute inset-x-0 top-1/2 h-[3px] bg-[#05040a]" />
        <div className="absolute inset-0 ring-[3px] ring-[#0a0810]" />
      </div>

      {/* desk lamp — sways, flickers, pools warm light below */}
      <div className="lamp-sway absolute left-1/2 top-0 -translate-x-1/2" style={{ animationDuration: `${swaySpeed}s` }}>
        <div className="mx-auto h-[13vmin] w-px bg-black/40" />
        <div className="lamp-flicker mx-auto -mt-1 h-3 w-3 rounded-full" style={{ background: LAMP, boxShadow: `0 0 26px 7px ${LAMP}`, opacity: lampGlow }} />
        <div className="lamp-flicker mx-auto h-[66vmin] w-[46vmin]"
          style={{
            opacity: lampGlow,
            background: `radial-gradient(ellipse 60% 92% at 50% 0%, color-mix(in oklab, ${LAMP} 58%, transparent) 0%, transparent 70%)`,
            clipPath: 'polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)',
          }} />
      </div>

      {/* the interrogator — a silhouette across the table, rim-lit by the lamp */}
      <div className="absolute bottom-0 left-1/2 h-[24vmin] w-[64vmin] -translate-x-1/2">
        <div className="absolute bottom-0 left-1/2 h-[13vmin] w-[46vmin] -translate-x-1/2 rounded-t-[48%] bg-[#030208]"
          style={{ boxShadow: `inset 0 2px 0 0 color-mix(in oklab, ${LAMP} 32%, transparent)` }} />
        <div className="absolute bottom-[10vmin] left-1/2 h-[11vmin] w-[11vmin] -translate-x-1/2 rounded-full bg-[#030208]"
          style={{ boxShadow: `inset 0 2px 0 0 color-mix(in oklab, ${LAMP} 38%, transparent)` }} />
      </div>

      {/* vignette */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 40%, transparent 38%, rgba(3,2,7,${vignette}) 100%)` }} />

      {/* static film grain (cheap) */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.045] mix-blend-overlay">
        <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
