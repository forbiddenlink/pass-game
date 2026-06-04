'use client';

import { useMemo, useState } from 'react';
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

// ---- solstice sky: daylight ratio -> mood ----
function sky(ratio: number): { bg: string; label: string } {
  const r = Math.max(0, Math.min(1, ratio));
  if (r > 0.75) return { bg: 'linear-gradient(#1e3a5f,#3b6ea5)', label: 'high sun' };
  if (r > 0.5) return { bg: 'linear-gradient(#274472,#7a6f9b)', label: 'afternoon' };
  if (r > 0.25) return { bg: 'linear-gradient(#3a2c4f,#b5651d)', label: 'low amber' };
  if (r > 0.05) return { bg: 'linear-gradient(#1a1326,#5e2a2a)', label: 'blood dusk' };
  return { bg: 'linear-gradient(#05050a,#1a1326)', label: 'the dark' };
}

export default function Game() {
  const [seed] = useState(() => 1); // fixed seed for now; daily mode later
  const [state, setState] = useState<GameState>(() => createGame({ seed }));
  const [judging, setJudging] = useState(false);
  const [message, setMessage] = useState<string>('');

  const ratio = state.daylight / state.econ.start;
  const theSky = sky(ratio);

  function reset() {
    setState(createGame({ seed }));
    setMessage('');
  }

  function onAttempt(guess: string) {
    const next = attemptDecode(state, guess);
    if (next.phase === 'replying') setMessage('');
    else if (next.status === 'lost') setMessage('');
    else if (next === state) return;
    else setMessage('Not quite. The sun drops. Try again.');
    setState(next);
  }

  async function onReply(text: string) {
    setJudging(true);
    let humanScore: number;
    let tell: string;
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
      const h = scoreReply(text); // client-side fallback if the route is unreachable
      humanScore = h.score;
      tell = h.tell;
    }
    setMessage(tell ? `They study you: ${tell}` : '');
    setState((s) => submitReply(s, humanScore));
    setJudging(false);
  }

  return (
    <main
      className="min-h-screen text-neutral-100 transition-[background] duration-1000"
      style={{ background: theSky.bg }}
    >
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
        <Header state={state} skyLabel={theSky.label} ratio={ratio} />

        {state.status === 'playing' ? (
          <>
            {state.phase === 'decoding' && (
              <DecodePanel
                puzzle={state.puzzle}
                hintUsed={state.hintUsed}
                onAttempt={onAttempt}
                onHint={() => setState(useHint(state))}
              />
            )}
            {state.phase === 'replying' && (
              <ReplyPanel
                question={state.puzzle.plaintext}
                judging={judging}
                onReply={onReply}
                onSkip={() => {
                  setMessage('');
                  setState(skipReply(state));
                }}
              />
            )}
            {message && <p className="text-sm text-amber-200/90 italic">{message}</p>}
          </>
        ) : (
          <EndingScreen state={state} onReset={reset} />
        )}
      </div>
    </main>
  );
}

function Header({ state, skyLabel, ratio }: { state: GameState; skyLabel: string; ratio: number }) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h1 className="font-mono text-lg tracking-[0.3em] text-amber-100">PASS</h1>
        <span className="text-xs text-neutral-300">
          night {state.turn}/{state.econ.turns} · {skyLabel}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-500 transition-[width] duration-700"
          style={{ width: `${Math.max(0, ratio) * 100}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-neutral-300">
        <span>daylight {state.daylight}</span>
        <span>suspicion {state.suspicion.toFixed(2)}</span>
        <span>humanity {state.humanity.count ? humanityAvg(state).toFixed(2) : '—'}</span>
      </div>
    </header>
  );
}

function DecodePanel({
  puzzle,
  hintUsed,
  onAttempt,
  onHint,
}: {
  puzzle: Puzzle;
  hintUsed: boolean;
  onAttempt: (guess: string) => void;
  onHint: () => void;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-black/30 p-5 backdrop-blur">
      <p className="text-xs uppercase tracking-widest text-neutral-400">interrogator · enciphered</p>
      <p className="font-mono text-xl break-words text-amber-100">{puzzle.ciphertext}</p>

      {puzzle.cipher.type === 'caesar' ? (
        <CaesarDial puzzle={puzzle} onAttempt={onAttempt} />
      ) : puzzle.cipher.type === 'substitution' ? (
        <SubstitutionGrid puzzle={puzzle} onAttempt={onAttempt} />
      ) : (
        <TypedDecode puzzle={puzzle} onAttempt={onAttempt} />
      )}

      {!hintUsed && (
        <button
          onClick={onHint}
          className="self-start text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
        >
          spend daylight for a hint
        </button>
      )}
    </section>
  );
}

// Caesar: a shift dial that live-decodes. The decode unlocking in real time IS the mechanic.
function CaesarDial({ puzzle, onAttempt }: { puzzle: Puzzle; onAttempt: (g: string) => void }) {
  const [shift, setShift] = useState(0);
  const preview = useMemo(() => decode(puzzle.ciphertext, { type: 'caesar', shift }), [puzzle, shift]);
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-lg text-neutral-50">{preview}</p>
      <label className="flex items-center gap-3 text-xs text-neutral-300">
        shift {shift}
        <input
          type="range"
          min={0}
          max={25}
          value={shift}
          onChange={(e) => setShift(Number(e.target.value))}
          className="flex-1 accent-amber-400"
        />
      </label>
      <button
        onClick={() => onAttempt(preview)}
        className="self-start rounded bg-amber-500/90 px-4 py-1.5 text-sm font-medium text-black hover:bg-amber-400"
      >
        this is it
      </button>
    </div>
  );
}

// Substitution: auto-propagate mapping grid — map a letter once, all instances update.
function SubstitutionGrid({ puzzle, onAttempt }: { puzzle: Puzzle; onAttempt: (g: string) => void }) {
  // seed the locked prefilled letters
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

  const preview = puzzle.ciphertext
    .split('')
    .map((c) => (c === ' ' ? ' ' : map[c] ?? '·'))
    .join('');

  const cipherLetters = Array.from(new Set(puzzle.ciphertext.replace(/ /g, '').split('')));

  function assign(plain: string) {
    if (!sel || locked[sel]) return;
    setMap((m) => ({ ...m, [sel]: plain }));
    setSel(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-lg tracking-wide text-neutral-50">{preview}</p>

      <div className="flex flex-wrap gap-1">
        {cipherLetters.map((c) => (
          <button
            key={c}
            onClick={() => !locked[c] && setSel(c)}
            className={`h-8 w-8 rounded font-mono text-sm ${
              locked[c]
                ? 'bg-amber-700/40 text-amber-200'
                : sel === c
                  ? 'bg-amber-400 text-black'
                  : 'bg-white/10 text-neutral-200 hover:bg-white/20'
            }`}
            title={map[c] ? `${c} → ${map[c]}` : c}
          >
            {map[c] ?? c}
          </button>
        ))}
      </div>

      {sel && (
        <div className="flex flex-wrap gap-1">
          {ALPHABET.map((p) => (
            <button
              key={p}
              onClick={() => assign(p)}
              className="h-7 w-7 rounded bg-white/5 font-mono text-xs text-neutral-300 hover:bg-amber-400 hover:text-black"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => onAttempt(preview)}
        className="self-start rounded bg-amber-500/90 px-4 py-1.5 text-sm font-medium text-black hover:bg-amber-400"
      >
        this is it
      </button>
    </div>
  );
}

// Vigenere (climax): typed, with the narratively-earned key revealed.
function TypedDecode({ puzzle, onAttempt }: { puzzle: Puzzle; onAttempt: (g: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex flex-col gap-3">
      {puzzle.revealedKey && (
        <p className="text-xs text-amber-200">the key, at last: <span className="font-mono">{puzzle.revealedKey}</span></p>
      )}
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="type the decoded line…"
        className="rounded bg-black/40 px-3 py-2 font-mono text-neutral-50 outline-none ring-1 ring-white/10 focus:ring-amber-400"
      />
      <button
        onClick={() => onAttempt(val)}
        className="self-start rounded bg-amber-500/90 px-4 py-1.5 text-sm font-medium text-black hover:bg-amber-400"
      >
        this is it
      </button>
    </div>
  );
}

function ReplyPanel({
  question,
  judging,
  onReply,
  onSkip,
}: {
  question: string;
  judging: boolean;
  onReply: (t: string) => void;
  onSkip: () => void;
}) {
  const [val, setVal] = useState('');
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-black/30 p-5 backdrop-blur">
      <p className="text-xs uppercase tracking-widest text-neutral-400">decoded · they ask</p>
      <p className="text-lg text-amber-100">“{question}?”</p>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        disabled={judging}
        rows={2}
        placeholder="answer as one of them… (costs daylight) or stay silent"
        className="resize-none rounded bg-black/40 px-3 py-2 text-neutral-50 outline-none ring-1 ring-white/10 focus:ring-amber-400"
      />
      <div className="flex gap-3">
        <button
          disabled={judging || !val.trim()}
          onClick={() => onReply(val)}
          className="rounded bg-amber-500/90 px-4 py-1.5 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-40"
        >
          {judging ? 'they consider…' : 'speak'}
        </button>
        <button
          disabled={judging}
          onClick={onSkip}
          className="rounded px-4 py-1.5 text-sm text-neutral-300 underline underline-offset-4 hover:text-neutral-100 disabled:opacity-40"
        >
          stay silent
        </button>
      </div>
    </section>
  );
}

const ENDINGS: Record<string, { title: string; line: string }> = {
  A: { title: 'You passed the night.', line: 'You did not just survive — you were believed.' },
  B: { title: 'You passed the night.', line: 'You survived. They never quite believed you.' },
  C: { title: 'You outlasted the dark.', line: 'On logic alone. No one knew you at all.' },
  OFF: { title: 'Switched off.', line: 'The light failed mid-sentence.' },
};

function EndingScreen({ state, onReset }: { state: GameState; onReset: () => void }) {
  const e = ENDINGS[state.ending ?? 'OFF'];
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl text-amber-100">{e.title}</h2>
        <p className="text-neutral-300">{e.line}</p>
      </div>
      <div className="max-w-md border-t border-white/10 pt-6 text-sm text-neutral-400">
        <p>
          The test you just sat was imagined by a man who spent his life being tested. Inspired by the
          work of Alan Turing.
        </p>
        <p className="mt-2 font-mono text-neutral-300">For Alan Turing, 1912–1954.</p>
      </div>
      <button
        onClick={onReset}
        className="rounded bg-amber-500/90 px-5 py-2 text-sm font-medium text-black hover:bg-amber-400"
      >
        another night
      </button>
    </section>
  );
}
