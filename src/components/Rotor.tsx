'use client';

import { useRef } from 'react';
import { sound } from '@/lib/sound';

/**
 * A real cipher rotor — a brass disc with the alphabet radiating around it that
 * physically turns. Drag it, step it, or arrow-key it; the notch at top reads
 * the current setting. Replaces the plain slider with something tactile and
 * on-theme (Enigma). Accessible: role=slider + keyboard + labelled controls.
 */
const N = 26;
const STEP = 360 / N;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function Rotor({ shift, onChange }: { shift: number; onChange: (s: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  const set = (s: number) => {
    const v = ((Math.round(s) % N) + N) % N;
    if (v !== shift) {
      sound.key();
      onChange(v);
    }
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(shift + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(shift - 1); }
  }

  function onPointerDown(e: React.PointerEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const start = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startShift = shift;
    const move = (ev: PointerEvent) => {
      const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      const deltaDeg = ((ang - start) * 180) / Math.PI;
      set(startShift + deltaDeg / STEP);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div className="flex items-center gap-6">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="cipher rotor"
        aria-valuemin={0}
        aria-valuemax={25}
        aria-valuenow={shift}
        aria-valuetext={`rotor at ${shift}`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        className="relative h-36 w-36 shrink-0 cursor-grab touch-none select-none rounded-full ring-1 ring-ember/30 active:cursor-grabbing"
        style={{ background: 'radial-gradient(circle at 38% 32%, #2a2118, #0c0a06 72%)', boxShadow: 'inset 0 0 28px rgba(0,0,0,0.7), 0 6px 20px rgba(0,0,0,0.5)' }}
      >
        {/* fixed notch / indicator at the top */}
        <div className="absolute left-1/2 top-1 -translate-x-1/2 text-ember">▼</div>
        {/* the turning ring of letters */}
        <div className="absolute inset-0 transition-transform duration-200 ease-out" style={{ transform: `rotate(${-shift * STEP}deg)` }}>
          {LETTERS.map((c, i) => (
            <span
              key={c}
              className="absolute left-1/2 top-1/2 font-[family-name:var(--font-mono)] text-[11px] text-bone-dim"
              style={{ transform: `rotate(${i * STEP}deg) translateY(-58px) translate(-50%,-50%)` }}
            >
              {c}
            </span>
          ))}
        </div>
        {/* hub */}
        <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle at 40% 35%, #4a3a22, #14100a)', boxShadow: 'inset 0 1px 2px rgba(244,178,88,0.25)' }} />
      </div>

      <div className="flex flex-col items-center gap-1">
        <button onClick={() => set(shift + 1)} aria-label="turn rotor forward" className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-bone-dim hover:bg-white/10 hover:text-bone">▲</button>
        <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-ember">{shift}</span>
        <button onClick={() => set(shift - 1)} aria-label="turn rotor back" className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-bone-dim hover:bg-white/10 hover:text-bone">▼</button>
      </div>
    </div>
  );
}
