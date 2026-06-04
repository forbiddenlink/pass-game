'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  createGame,
  attemptDecode,
  useHint,
  submitReply,
  skipReply,
  humanityAvg,
  type GameState,
} from '@/lib/game';
import { decode } from '@/lib/cipher';
import { scoreReply } from '@/lib/score';
import type { Puzzle } from '@/lib/puzzle';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/* ---------- the temperature system: daylight ratio -> sky ---------- */
const clampR = (n: number) => Math.max(0, Math.min(1, n));
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
const tri = (r: number, hi: string, mid: string, lo: string) =>
  r >= 0.5 ? mix(mid, hi, (r - 0.5) * 2) : mix(lo, mid, r * 2);

const PHASE_NAME = (r: number) =>
  r > 0.8 ? 'the long noon'
  : r > 0.55 ? 'the sun leans west'
  : r > 0.3 ? 'amber hour'
  : r > 0.08 ? 'the red gate'
  : 'dark';

export default function Game() {
  const [seed] = useState(() => 1);
  const [state, setState] = useState<GameState>(() => createGame({ seed }));
  const [judging, setJudging] = useState(false);
  const [message, setMessage] = useState('');
  const reduce = useReducedMotion();

  const r = clampR(state.daylight / state.econ.start);
  const skyTop = tri(r, '#1b3a5c', '#2a2540', '#080610');
  const skyBot = tri(r, '#c8773c', '#74383a', '#140f1c');
  const sunCol = tri(r, '#ffd98a', '#e07b38', '#3a2030');

  function reset() {
    setState(createGame({ seed }));
    setMessage('');
  }
  function onAttempt(guess: string) {
    const next = attemptDecode(state, guess);
    if (next === state) return;
    setMessage(next.phase === 'decoding' && next.status === 'playing' ? 'Not yet. The light slips. Again.' : '');
    setState(next);
  }
  async function onReply(text: string) {
    setJudging(true);
    let humanScore: number, tell: string;
    try {
      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: state.puzzle.plaintext, reply: text }),
      });
      const j = await res.json();
      humanScore = j.humanScore;
      tell = j.tell;
    } catch {
      const h = scoreReply(text);
      humanScore = h.score;
      tell = h.tell;
    }
    setMessage(tell ? `They study you — ${tell}.` : '');
    setState((s) => submitReply(s, humanScore));
    setJudging(false);
  }

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden"
      style={{ background: `linear-gradient(${skyTop} 0%, ${skyBot} 100%)`, transition: 'background 1200ms ease-out' }}
    >
      {/* the sun — the one thing you remember. it sinks as daylight is spent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -z-0 h-[44vmin] w-[44vmin] -translate-x-1/2 rounded-full blur-[2px]"
        style={{
          top: `${(1 - r) * 70 + 4}%`,
          background: `radial-gradient(circle, ${sunCol} 0%, ${mix(sunCol, skyBot, 0.6)} 45%, transparent 70%)`,
          opacity: clampR(r * 1.5),
          transition: reduce ? 'none' : 'top 1200ms ease-out, opacity 1200ms ease-out',
        }}
      />
      {/* scrim: keeps prose legible over a bright horizon */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0"
        style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(8,6,12,.55) 100%)' }} />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-8 px-6 py-10 sm:py-14">
        <Header state={state} r={r} />

        {state.status === 'playing' ? (
          <AnimatePresence mode="wait">
            {state.phase === 'decoding' ? (
              <Panel key={`d${state.turn}`} reduce={!!reduce}>
                <DecodePanel
                  puzzle={state.puzzle}
                  hintUsed={state.hintUsed}
                  onAttempt={onAttempt}
                  onHint={() => setState(useHint(state))}
                />
              </Panel>
            ) : (
              <Panel key={`r${state.turn}`} reduce={!!reduce}>
                <ReplyPanel
                  question={state.puzzle.plaintext}
                  judging={judging}
                  onReply={onReply}
                  onSkip={() => {
                    setMessage('');
                    setState(skipReply(state));
                  }}
                />
              </Panel>
            )}
          </AnimatePresence>
        ) : (
          <EndingScreen state={state} onReset={reset} />
        )}

        <p role="status" aria-live="polite" className="min-h-[1.25rem] font-[family-name:var(--font-display)] text-[15px] italic text-ember">
          {message}
        </p>
      </div>
    </main>
  );
}

function Panel({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-5 rounded-sm bg-[rgba(10,8,14,0.6)] p-6 backdrop-blur-[3px] ring-1 ring-white/5"
    >
      {children}
    </motion.section>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-ash">{children}</p>
);

function Header({ state, r }: { state: GameState; r: number }) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none tracking-[0.34em] text-bone">
          PASS
        </h1>
        <span className="font-[family-name:var(--font-sans)] text-[11px] lowercase tracking-wide text-bone-dim">
          night {state.turn} of {state.econ.turns} · {PHASE_NAME(r)}
        </span>
      </div>
      {/* daylight as a receding line of light, not a HUD bar */}
      <div className="relative h-px w-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-ember-deep to-ember"
          style={{ width: `${r * 100}%`, transition: 'width 700ms ease-out' }}
        />
      </div>
      <div className="flex justify-between font-[family-name:var(--font-mono)] text-[10px] text-ash">
        <span>light {state.daylight}</span>
        <span>doubt {state.suspicion.toFixed(2)}</span>
        <span>{state.humanity.count ? `believed ${humanityAvg(state).toFixed(2)}` : 'unspoken'}</span>
      </div>
    </header>
  );
}

function DecodePanel({
  puzzle, hintUsed, onAttempt, onHint,
}: { puzzle: Puzzle; hintUsed: boolean; onAttempt: (g: string) => void; onHint: () => void }) {
  return (
    <>
      <Label>intercept · enciphered</Label>
      <p aria-label="enciphered message" className="font-[family-name:var(--font-mono)] text-xl tracking-[0.12em] text-ember break-words">
        {puzzle.ciphertext}
      </p>
      {puzzle.cipher.type === 'caesar' ? (
        <CaesarDial puzzle={puzzle} onAttempt={onAttempt} />
      ) : puzzle.cipher.type === 'substitution' ? (
        <SubstitutionGrid puzzle={puzzle} onAttempt={onAttempt} />
      ) : (
        <TypedDecode puzzle={puzzle} onAttempt={onAttempt} />
      )}
      {!hintUsed && (
        <button onClick={onHint} className="self-start text-[11px] uppercase tracking-widest text-ash underline-offset-4 hover:text-bone-dim hover:underline">
          spend light for a tell
        </button>
      )}
    </>
  );
}

const Submit = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="self-start rounded-sm bg-ember px-5 py-2 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-colors hover:bg-[#ffb74d]">
    this is what they said
  </button>
);

function CaesarDial({ puzzle, onAttempt }: { puzzle: Puzzle; onAttempt: (g: string) => void }) {
  const [shift, setShift] = useState(0);
  const preview = useMemo(() => decode(puzzle.ciphertext, { type: 'caesar', shift }), [puzzle, shift]);
  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" className="font-[family-name:var(--font-display)] text-lg text-bone">{preview}</p>
      <label className="flex items-center gap-4 text-[11px] uppercase tracking-widest text-ash">
        <span className="tabular-nums">turn {shift}</span>
        <input
          type="range" min={0} max={25} value={shift}
          onChange={(e) => setShift(Number(e.target.value))}
          aria-label="cipher rotor" aria-valuetext={`rotor at ${shift} of 25`}
          className="h-1 flex-1 cursor-pointer accent-ember"
        />
      </label>
      <Submit onClick={() => onAttempt(preview)} />
    </div>
  );
}

// auto-propagate: map one letter, every instance resolves. the core decode joy.
function SubstitutionGrid({ puzzle, onAttempt }: { puzzle: Puzzle; onAttempt: (g: string) => void }) {
  const locked = useMemo(() => {
    const m: Record<string, string> = {};
    for (const i of puzzle.prefilled) {
      const c = puzzle.ciphertext[i];
      if (c && c !== ' ') m[c] = puzzle.plaintext[i];
    }
    return m;
  }, [puzzle]);

  const [map, setMap] = useState<Record<string, string>>(() => ({ ...locked }));
  const [sel, setSel] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sel) pickerRef.current?.querySelector('button')?.focus();
  }, [sel]);

  const cipherLetters = useMemo(
    () => Array.from(new Set(puzzle.ciphertext.replace(/ /g, '').split(''))),
    [puzzle],
  );
  const previewChars = puzzle.ciphertext.split('');

  function assign(plain: string) {
    if (!sel || locked[sel]) return;
    setMap((m) => {
      const n = { ...m };
      for (const k in n) if (n[k] === plain && !locked[k]) delete n[k]; // dedupe: one plaintext, one cipher
      n[sel] = plain;
      return n;
    });
    setSel(null);
  }

  const guess = previewChars.map((c) => (c === ' ' ? ' ' : map[c] ?? '·')).join('');

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" aria-label={`decoded so far: ${guess.replace(/·/g, 'blank')}`} className="font-[family-name:var(--font-display)] text-lg tracking-wide">
        {previewChars.map((c, i) =>
          c === ' ' ? ' ' : (
            <span key={i} className={map[c] ? 'text-bone' : 'text-ash/60'}>
              {map[c] ?? '·'}
            </span>
          ),
        )}
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="enciphered letters">
        {cipherLetters.map((c) => (
          <button
            key={c}
            disabled={!!locked[c]}
            aria-pressed={sel === c}
            aria-label={locked[c] ? `${c}, fixed as ${locked[c]}` : map[c] ? `${c}, read as ${map[c]}` : `${c}, unread`}
            onClick={() => setSel(c)}
            className={`h-9 w-9 rounded-sm font-[family-name:var(--font-mono)] text-sm transition-colors ${
              locked[c]
                ? 'bg-ember-deep/30 text-ember'
                : sel === c
                  ? 'bg-ember text-ink ring-2 ring-bone'
                  : 'bg-white/[0.07] text-bone-dim hover:bg-white/15'
            }`}
          >
            {map[c] ?? c}
          </button>
        ))}
      </div>

      {sel && (
        <div ref={pickerRef} role="group" aria-label={`choose a letter for ${sel}`} className="flex flex-wrap gap-1">
          {ALPHABET.map((p) => (
            <button key={p} onClick={() => assign(p)} className="h-7 w-7 rounded-sm bg-white/[0.04] font-[family-name:var(--font-mono)] text-xs text-bone-dim hover:bg-ember hover:text-ink">
              {p}
            </button>
          ))}
        </div>
      )}

      <Submit onClick={() => onAttempt(guess)} />
    </div>
  );
}

function TypedDecode({ puzzle, onAttempt }: { puzzle: Puzzle; onAttempt: (g: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex flex-col gap-4">
      {puzzle.revealedKey && (
        <p className="text-[11px] uppercase tracking-widest text-ash">
          the key, at last — <span className="font-[family-name:var(--font-mono)] text-ember">{puzzle.revealedKey}</span>
        </p>
      )}
      <input
        value={val} onChange={(e) => setVal(e.target.value)}
        aria-label="your decoding" placeholder="set down the line they spoke…"
        className="rounded-sm bg-black/40 px-4 py-3 font-[family-name:var(--font-display)] text-lg text-bone outline-none ring-1 ring-white/10 placeholder:text-ash/60"
      />
      <Submit onClick={() => onAttempt(val)} />
    </div>
  );
}

function ReplyPanel({
  question, judging, onReply, onSkip,
}: { question: string; judging: boolean; onReply: (t: string) => void; onSkip: () => void }) {
  const [val, setVal] = useState('');
  return (
    <>
      <Label>decoded · they ask</Label>
      <p className="font-[family-name:var(--font-display)] text-2xl italic leading-snug text-bone">“{question}?”</p>
      <textarea
        value={val} onChange={(e) => setVal(e.target.value)} disabled={judging} rows={2}
        aria-label="your reply"
        placeholder="answer as one of them — it costs light — or hold your silence"
        className="resize-none rounded-sm bg-black/40 px-4 py-3 text-[15px] text-bone outline-none ring-1 ring-white/10 placeholder:text-ash/60 disabled:opacity-50"
      />
      <div className="flex items-center gap-5">
        <button
          disabled={judging || !val.trim()} onClick={() => onReply(val)}
          className="rounded-sm bg-ember px-5 py-2 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-colors hover:bg-[#ffb74d] disabled:opacity-40"
        >
          {judging ? 'they consider…' : 'speak'}
        </button>
        <button disabled={judging} onClick={onSkip} className="text-[11px] uppercase tracking-widest text-bone-dim underline-offset-4 hover:text-bone hover:underline disabled:opacity-40">
          stay silent
        </button>
      </div>
    </>
  );
}

const ENDINGS: Record<string, { title: string; line: string }> = {
  A: { title: 'You passed the night.', line: 'Not survived — believed. They let you walk into the morning.' },
  B: { title: 'You passed the night.', line: 'You survived it. They never quite believed you.' },
  C: { title: 'You outlasted the dark.', line: 'On logic alone. No one ever knew you at all.' },
  OFF: { title: 'Switched off.', line: 'The light failed in the middle of a word.' },
};

function EndingScreen({ state, onReset }: { state: GameState; onReset: () => void }) {
  const e = ENDINGS[state.ending ?? 'OFF'];
  return (
    <motion.section
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }}
      className="flex flex-1 flex-col items-start justify-center gap-8"
    >
      <div className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-bone">{e.title}</h2>
        <p className="max-w-sm text-[15px] leading-relaxed text-bone-dim">{e.line}</p>
      </div>
      <div className="max-w-md border-t border-white/10 pt-6">
        <p className="font-[family-name:var(--font-display)] text-[15px] italic leading-relaxed text-bone-dim">
          The test you sat tonight was imagined by a man who spent his life being tested. Inspired by the work of Alan Turing.
        </p>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[13px] text-ember">For Alan Turing · 1912–1954</p>
      </div>
      <button onClick={onReset} className="rounded-sm bg-ember px-6 py-2.5 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-colors hover:bg-[#ffb74d]">
        another night
      </button>
    </motion.section>
  );
}
