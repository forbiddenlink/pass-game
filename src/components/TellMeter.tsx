'use client';

import { useMemo } from 'react';
import { scoreReply } from '@/lib/score';

/**
 * The tell-meter — a phosphor oscilloscope wired to the subject. It reads your
 * reply as you type (the offline humanity heuristic, client-side): a flat, cold
 * trace when the words read machine-like, a warm living waveform when they read
 * human. A second, legible feedback loop, and a period instrument. It is a
 * READ, not the verdict — the real judge is the interrogator (Gemini).
 */
const W = 280;
const H = 40;
const MID = H / 2;

/* Three discrete readings, anchored to the judge's own thresholds (truth ≥ 0.7,
   doubt ≥ 0.45, else a lie) so the live read and the verdict speak one language.
   The glyph echoes the trace itself: a live spike, a shallow waver, a flat line. */
type Reading = 'idle' | 'truth' | 'doubt' | 'lie';
const READ: Record<Reading, { label: string; color: string; glyph: string }> = {
  idle: { label: 'awaiting a voice', color: '#8a8194', glyph: 'M1 6 L11 6' },
  truth: { label: 'reads true', color: '#f0a338', glyph: 'M1 6 L3 6 L4.4 1.5 L6 10.5 L7.6 3.5 L9 6 L11 6' },
  doubt: { label: 'reads uncertain', color: '#c8bca6', glyph: 'M1 6 Q3 3.4 5 6 Q7 8.6 9 6 L11 6' },
  lie: { label: 'reads false', color: '#8a8194', glyph: 'M1 6 L11 6' },
};

export default function TellMeter({ text }: { text: string }) {
  const { points, reading } = useMemo(() => {
    const s = text.trim() ? scoreReply(text).score : 0;
    const amp = 1.5 + s * (MID - 3);
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 4) {
      const y = MID + Math.sin(x / 13) * amp * (0.6 + 0.4 * Math.sin(x / 41));
      pts.push(`${x},${y.toFixed(1)}`);
    }
    const rd: Reading = !text.trim() ? 'idle' : s >= 0.7 ? 'truth' : s >= 0.45 ? 'doubt' : 'lie';
    return { points: pts.join(' '), reading: rd };
  }, [text]);
  const { label, color, glyph } = READ[reading];

  return (
    <div className="flex items-center gap-3 rounded-sm border border-white/10 bg-black/40 px-3 py-2">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 flex-1" aria-hidden>
        <line x1="0" y1={MID} x2={W} y2={MID} stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke 0.4s ease' }} />
      </svg>
      <span className="flex w-28 shrink-0 items-center justify-end gap-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest" style={{ color }} aria-label={`reading: ${label}`}>
        <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden>
          <path d={glyph} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'd 0.3s ease' }} />
        </svg>
        <span className="text-right">{label}</span>
      </span>
    </div>
  );
}
