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

export default function TellMeter({ text }: { text: string }) {
  const { points, color, label } = useMemo(() => {
    const s = text.trim() ? scoreReply(text).score : 0;
    const amp = 1.5 + s * (MID - 3);
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 4) {
      const y = MID + Math.sin(x / 13) * amp * (0.6 + 0.4 * Math.sin(x / 41));
      pts.push(`${x},${y.toFixed(1)}`);
    }
    const c = s >= 0.6 ? '#f0a338' : s >= 0.42 ? '#c8bca6' : '#8a8194';
    const l = !text.trim() ? 'awaiting a voice' : s >= 0.7 ? 'reads human' : s >= 0.45 ? 'uncertain' : 'reads like a machine';
    return { score: s, points: pts.join(' '), color: c, label: l };
  }, [text]);

  return (
    <div className="flex items-center gap-3 rounded-sm border border-white/10 bg-black/40 px-3 py-2">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 flex-1" aria-hidden>
        <line x1="0" y1={MID} x2={W} y2={MID} stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke 0.4s ease' }} />
      </svg>
      <span className="w-28 shrink-0 text-right font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest" style={{ color }} aria-label={`reading: ${label}`}>
        {label}
      </span>
    </div>
  );
}
