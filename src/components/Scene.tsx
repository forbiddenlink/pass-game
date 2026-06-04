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

// fixed scatter of dust motes for the lamplight (deterministic, no layout jank)
const MOTES = [
  { x: 18, y: 30, d: 9, delay: 0 }, { x: 34, y: 60, d: 11, delay: 2 }, { x: 47, y: 20, d: 8, delay: 1 },
  { x: 58, y: 50, d: 12, delay: 3 }, { x: 70, y: 35, d: 10, delay: 0.5 }, { x: 26, y: 72, d: 13, delay: 4 },
  { x: 52, y: 80, d: 9.5, delay: 2.5 }, { x: 64, y: 66, d: 11.5, delay: 1.5 }, { x: 40, y: 44, d: 10.5, delay: 3.5 },
  { x: 78, y: 55, d: 12.5, delay: 5 }, { x: 30, y: 18, d: 8.5, delay: 6 }, { x: 60, y: 28, d: 9, delay: 4.5 },
];

export default function Scene({
  r, suspicion, skyTop, skyBot, sunCol,
}: { r: number; suspicion: number; skyTop: string; skyBot: string; sunCol: string }) {
  const lampGlow = 0.5 + (1 - r) * 0.5;
  const vignette = Math.min(0.86, 0.3 + (1 - r) * 0.42 + suspicion * 0.22); // the room dies with the light
  const swaySpeed = 8 - suspicion * 4;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      {/* barred window — the hero. iron bars, a hard sun disc with bloom, bars shadowing in. */}
      <div className="absolute right-[4%] top-[9%] h-[28vmin] w-[20vmin] overflow-hidden rounded-[2px] opacity-80 shadow-[0_0_70px_rgba(0,0,0,0.7)] sm:right-[5%] sm:top-[9%] sm:h-[42vmin] sm:w-[30vmin] sm:opacity-100"
        style={{ background: `linear-gradient(${skyTop}, ${skyBot})`, boxShadow: '0 0 70px rgba(0,0,0,0.7), inset 0 0 26px rgba(0,0,0,0.55)' }}>
        {/* the sun, with bloom */}
        <div className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            top: `${(1 - r) * 56 + 8}%`,
            height: '13vmin', width: '13vmin',
            background: `radial-gradient(circle, #fff6e0 0%, #fff2cf 22%, ${sunCol} 42%, ${skyBot} 66%, transparent 74%)`,
            boxShadow: `0 0 11vmin 3vmin ${sunCol}`,
            opacity: Math.max(0, Math.min(1, r * 1.4)),
          }} />
        {/* haze band on the horizon */}
        <div className="absolute inset-x-0" style={{ top: `${(1 - r) * 56 + 12}%`, height: '6vmin', background: `linear-gradient(transparent, color-mix(in oklab, ${sunCol} 55%, ${skyBot}), transparent)`, opacity: Math.max(0, Math.min(0.6, r)) }} />
        {/* glass: a faint diagonal reflection */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(122deg, transparent 42%, rgba(255,240,210,0.07) 50%, transparent 58%)' }} />
        {/* iron bars, rail-lit on one edge + cast shadow */}
        {[25, 50, 75].map((x) => (
          <div key={x} className="absolute inset-y-0" style={{ left: `${x}%`, width: '4px', background: 'linear-gradient(90deg,#0a0810,#05040a)', boxShadow: `inset 1px 0 0 color-mix(in oklab, ${LAMP} 22%, transparent), 4px 0 9px rgba(0,0,0,0.5)` }} />
        ))}
        <div className="absolute inset-x-0 top-1/2 h-[4px]" style={{ background: '#05040a', boxShadow: `inset 0 1px 0 color-mix(in oklab, ${LAMP} 20%, transparent)` }} />
        {/* sill + frame */}
        <div className="absolute inset-x-0 bottom-0 h-[2.4vmin] bg-[#06040a] shadow-[0_-2px_8px_rgba(0,0,0,0.6)]" />
        <div className="absolute inset-0 rounded-[2px] ring-[4px] ring-[#0a0810]" style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.55)' }} />
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

      {/* the desk: a warm lit surface under the lamp so the page rests in the room, not in a void */}
      <div className="absolute inset-x-0 bottom-0 h-[46vmin]" style={{ opacity: lampGlow, background: `radial-gradient(ellipse 75% 100% at 50% 100%, color-mix(in oklab, ${LAMP} 13%, transparent) 0%, transparent 68%)` }} />

      {/* dust adrift in the lamplight */}
      <div className="absolute left-1/2 top-[18vmin] h-[44vmin] w-[40vmin] -translate-x-1/2" style={{ opacity: lampGlow }}>
        {MOTES.map((m, i) => (
          <span key={i} className="mote absolute h-[3px] w-[3px] rounded-full"
            style={{ left: `${m.x}%`, top: `${m.y}%`, background: LAMP, animationDuration: `${m.d}s`, animationDelay: `${m.delay}s` }} />
        ))}
      </div>

      {/* the interrogator — a fedora silhouette across the table, rim-lit by the lamp */}
      <div className="absolute bottom-0 left-1/2 h-[28vmin] w-[64vmin] -translate-x-1/2">
        <div className="absolute bottom-0 left-1/2 h-[13vmin] w-[46vmin] -translate-x-1/2 rounded-t-[48%] bg-[#030208]"
          style={{ boxShadow: `inset 0 2px 0 0 color-mix(in oklab, ${LAMP} 30%, transparent)` }} />
        <div className="absolute bottom-[10vmin] left-1/2 h-[11vmin] w-[11vmin] -translate-x-1/2 rounded-full bg-[#030208]"
          style={{ boxShadow: `inset 0 2px 0 0 color-mix(in oklab, ${LAMP} 36%, transparent)` }} />
        {/* fedora: brim + crown */}
        <div className="absolute bottom-[18.5vmin] left-1/2 h-[2.4vmin] w-[19vmin] -translate-x-1/2 rounded-[50%] bg-[#020106]"
          style={{ boxShadow: `inset 0 2px 0 0 color-mix(in oklab, ${LAMP} 30%, transparent)` }} />
        <div className="absolute bottom-[19.5vmin] left-1/2 h-[4.6vmin] w-[10vmin] -translate-x-1/2 rounded-t-[42%] bg-[#020106]" />
      </div>

      {/* vignette */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 40%, transparent 38%, rgba(3,2,7,${vignette}) 100%)` }} />

      {/* rolling film grain (cheap — drift via transform, not re-rendered turbulence) */}
      <svg className="grain absolute inset-[-6%] h-[112%] w-[112%] opacity-[0.05] mix-blend-overlay">
        <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
