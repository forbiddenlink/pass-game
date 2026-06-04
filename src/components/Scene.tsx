'use client';

/**
 * The interrogation room — a CSS/SVG scene behind the play surface. Turns
 * "text on a gradient" into a place: a barred window where the solstice sun
 * sets (the daylight), a swinging desk lamp whose cone is the only warmth, the
 * interrogator a silhouette across the table, a vignette that tightens as doubt
 * rises, and film grain. All driven by the live daylight ratio + suspicion.
 */
export default function Scene({
  r, suspicion, skyTop, skyBot, sunCol,
}: { r: number; suspicion: number; skyTop: string; skyBot: string; sunCol: string }) {
  const lampGlow = 0.45 + (1 - r) * 0.5; // the lamp matters more as the day dies
  const vignette = 0.32 + suspicion * 0.46; // the room closes in with suspicion
  const swaySpeed = 8 - suspicion * 4; // faster sway = more menace

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      {/* barred window, upper right — the sun sets inside it */}
      <div className="absolute right-[5%] top-[5%] h-[40vmin] w-[30vmin] overflow-hidden rounded-[2px] shadow-[0_0_60px_rgba(0,0,0,0.6)] ring-1 ring-black/40"
        style={{ background: `linear-gradient(${skyTop}, ${skyBot})` }}>
        <div className="absolute left-1/2 h-[16vmin] w-[16vmin] -translate-x-1/2 rounded-full blur-[1px]"
          style={{ top: `${(1 - r) * 58 + 8}%`, background: `radial-gradient(circle, ${sunCol} 0%, ${skyBot} 60%, transparent 75%)`, opacity: Math.max(0, Math.min(1, r * 1.4)) }} />
        {/* mullion bars */}
        <div className="absolute inset-y-0 left-1/3 w-px bg-black/45" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-black/45" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/45" />
        <div className="absolute inset-0 ring-2 ring-black/50" />
      </div>

      {/* hanging desk lamp, top center — sways, flickers, pools light below */}
      <div className="lamp-sway absolute left-1/2 top-0 -translate-x-1/2" style={{ animationDuration: `${swaySpeed}s` }}>
        <div className="mx-auto h-[14vmin] w-px bg-black/40" />
        <div className="lamp-flicker mx-auto -mt-1 h-3 w-3 rounded-full"
          style={{ background: sunCol, boxShadow: `0 0 24px 6px ${sunCol}`, opacity: lampGlow }} />
        <div className="lamp-flicker mx-auto h-[64vmin] w-[44vmin]"
          style={{
            opacity: lampGlow,
            background: `radial-gradient(ellipse 60% 90% at 50% 0%, color-mix(in oklab, ${sunCol} 55%, transparent) 0%, transparent 70%)`,
            clipPath: 'polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)',
          }} />
      </div>

      {/* the interrogator — a silhouette across the table */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <div className="relative h-[22vmin] w-[60vmin]">
          <div className="absolute bottom-0 left-1/2 h-[12vmin] w-[44vmin] -translate-x-1/2 rounded-t-[48%] bg-[#040308]"
            style={{ boxShadow: `inset 0 2px 0 0 color-mix(in oklab, ${sunCol} 30%, transparent)` }} />
          <div className="absolute bottom-[9vmin] left-1/2 h-[11vmin] w-[11vmin] -translate-x-1/2 rounded-full bg-[#040308]"
            style={{ boxShadow: `inset 0 2px 0 0 color-mix(in oklab, ${sunCol} 35%, transparent)` }} />
        </div>
      </div>

      {/* vignette — tightens with suspicion */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 38%, transparent 40%, rgba(4,3,8,${vignette}) 100%)` }} />

      {/* film grain */}
      <svg className="grain absolute inset-[-5%] h-[110%] w-[110%] opacity-[0.05] mix-blend-overlay">
        <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
