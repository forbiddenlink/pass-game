'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  createGame,
  attemptDecode,
  useHint,
  recordReply,
  advance,
  skipReply,
  humanityAvg,
  type GameState,
} from '@/lib/game';
import { decode } from '@/lib/cipher';
import { scoreReply } from '@/lib/score';
import { interrogatorLine, pressLine } from '@/lib/lines';
import { sound } from '@/lib/sound';
import Scene from '@/components/Scene';
import Rotor from '@/components/Rotor';
import type { Puzzle } from '@/lib/puzzle';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const COMMON = new Set('the and you what does day mean to me my a i is it do we when who are of from on out'.split(' '));
const looksEnglish = (s: string) =>
  !s.includes('·') && s.trim().split(/\s+/).filter((w) => COMMON.has(w)).length >= 2;

/* ---------- temperature system ---------- */
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
  r > 0.8 ? 'the long noon' : r > 0.55 ? 'the sun leans west' : r > 0.3 ? 'amber hour' : r > 0.08 ? 'the red gate' : 'dark';

const DECODE_HINT: Record<string, string> = {
  caesar: 'Turn the rotor until the line reads as true words.',
  substitution: 'Tap an enciphered letter, then choose what it truly is. Every copy follows.',
  vigenere: 'Use the key. Set down the line by hand.',
};
const CIPHER_LABEL: Record<string, string> = { caesar: 'caesar rotor', substitution: 'substitution', vigenere: 'vigenère' };
const HINT_LABEL: Record<string, string> = {
  caesar: 'spend light for the rotor setting',
  substitution: 'spend light to reveal two letters',
  vigenere: 'spend light for the opening words',
};
const shadow = '[text-shadow:0_1px_4px_rgba(8,6,12,0.92)]';

type Verdict = { line: string; tell: string; good: boolean; humanScore: number; skip: boolean; question: string; replyText: string };
type Exchange = { q: string; a: string; line: string; press: boolean };

export default function Game() {
  const [seed] = useState(() => 1);
  const [state, setState] = useState<GameState>(() => createGame({ seed }));
  const [judging, setJudging] = useState(false);
  const [message, setMessage] = useState('');
  const [brief, setBrief] = useState(true);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pressing, setPressing] = useState<string | null>(null); // null = not pressing; '' = loading; else the follow-up
  const [pressed, setPressed] = useState(false);
  const [transcript, setTranscript] = useState<Exchange[]>([]);
  const [muted, setMuted] = useState(false);
  const reduce = useReducedMotion();

  const r = clampR(state.daylight / state.econ.start);
  const skyTop = tri(r, '#1b3a5c', '#2a2540', '#080610');
  const skyBot = tri(r, '#c8773c', '#74383a', '#140f1c');
  const sunCol = tri(r, '#ffd98a', '#e07b38', '#3a2030');
  const ease1200 = reduce ? 'none' : '1200ms ease-out';

  useEffect(() => { sound.ambient(r); }, [r]);
  useEffect(() => {
    if (state.status === 'lost') sound.switchOff();
    if (state.status === 'won') sound.verdict(true);
  }, [state.status]);
  // the clock: ticks faster as the light fails — urgency without a real-time death
  useEffect(() => {
    if (state.status !== 'playing' || brief) return;
    const period = 360 + r * 1500;
    const id = window.setInterval(() => sound.clock(), period);
    return () => window.clearInterval(id);
  }, [r, state.status, brief]);

  const lowLight = r < 0.28;

  function begin() {
    sound.init();
    sound.startDrone();
    setBrief(false);
  }
  function reset() {
    setState(createGame({ seed }));
    setMessage('');
    setVerdict(null);
    setPressing(null);
    setPressed(false);
    setTranscript([]);
  }
  function onAttempt(guess: string) {
    const next = attemptDecode(state, guess);
    if (next === state) return;
    if (next.phase === 'replying') sound.resolved();
    else if (next.status === 'lost') {/* switchOff via effect */}
    else sound.tick();
    setMessage(next.phase === 'decoding' && next.status === 'playing' ? `Not yet. The light slips. (−${state.econ.wrong})` : '');
    setState(next);
  }
  async function onReply(text: string) {
    const q = pressing ?? state.puzzle.plaintext;
    setJudging(true);
    let humanScore: number, tell: string, line: string;
    try {
      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, reply: text }),
      });
      const j = await res.json();
      humanScore = j.humanScore;
      tell = j.tell;
      line = j.line || interrogatorLine(j.humanScore, text.length);
    } catch {
      const h = scoreReply(text);
      humanScore = h.score;
      tell = h.tell;
      line = interrogatorLine(h.score, text.length);
    }
    setJudging(false);
    const good = humanScore >= 0.45;
    sound.verdict(good);
    setVerdict({ line, tell, good, humanScore, skip: false, question: q, replyText: text });
  }
  function onSkip() {
    sound.verdict(false);
    setVerdict({ line: interrogatorLine(0, state.turn), tell: '', good: false, humanScore: 0, skip: true, question: pressing ?? state.puzzle.plaintext, replyText: '' });
  }
  async function resolveVerdict() {
    if (!verdict) return;
    const v = verdict;
    const wasPress = pressing !== null;
    sound.tick();
    setVerdict(null);
    setMessage('');
    setTranscript((t) => [...t, { q: v.question, a: v.skip ? '— silence —' : v.replyText, line: v.line, press: wasPress }]);

    const next = v.skip ? skipReply(state) : recordReply(state, v.humanScore);
    if (next.status !== 'playing') {
      setState(next);
      setPressing(null);
      setPressed(false);
      return;
    }
    // a suspicious spoken answer earns ONE sharper follow-up — the interrogation presses
    if (!v.skip && !pressed && v.humanScore < 0.5) {
      setState(next); // light + humanity recorded, phase still 'replying'
      setPressed(true);
      setPressing(''); // loading sentinel -> press panel shows "they lean in close…"
      try {
        const res = await fetch('/api/press', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: v.question, reply: v.replyText }),
        });
        const j = await res.json();
        setPressing(j.followup || pressLine(v.replyText.length));
      } catch {
        setPressing(pressLine(v.replyText.length));
      }
      return;
    }
    // otherwise the night moves on
    setState(advance(next));
    setPressing(null);
    setPressed(false);
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden"
      style={{ background: `linear-gradient(${skyTop} 0%, ${skyBot} 100%)`, transition: `background ${ease1200}` }}>
      <Scene r={r} suspicion={state.suspicion} skyTop={skyTop} skyBot={skyBot} sunCol={sunCol} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0"
        style={{ background: 'linear-gradient(to bottom, rgba(6,5,10,.55) 0%, transparent 15%, transparent 60%, rgba(8,6,12,.7) 100%)' }} />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-6 py-10 sm:py-14">
        <div className="flex w-full max-w-[34rem] flex-col gap-8">
          <Header state={state} r={r} muted={muted} lowLight={lowLight} onHelp={() => setBrief(true)} onMute={() => setMuted(sound.toggleMute())} />

          {state.status === 'playing' && transcript.length > 0 && <Transcript items={transcript} />}

          {state.status === 'playing' ? (
            <AnimatePresence mode="wait">
              {verdict ? (
                <Panel key={`v${transcript.length}`} reduce={!!reduce}>
                  <VerdictBeat verdict={verdict} onContinue={resolveVerdict} last={state.turn >= state.econ.turns && !verdict.skip && (pressing !== null || verdict.humanScore >= 0.4)} />
                </Panel>
              ) : state.phase === 'decoding' ? (
                <Panel key={`d${state.turn}`} reduce={!!reduce}>
                  <DecodePanel puzzle={state.puzzle} hintUsed={state.hintUsed} onAttempt={onAttempt} onHint={() => { sound.key(); setState(useHint(state)); }} />
                </Panel>
              ) : (
                <Panel key={pressing !== null ? `p${transcript.length}` : `r${state.turn}`} reduce={!!reduce}>
                  <ReplyPanel
                    question={pressing !== null ? pressing : state.puzzle.plaintext}
                    pressing={pressing !== null}
                    loading={pressing === ''}
                    judging={judging}
                    onReply={onReply}
                    onSkip={onSkip}
                  />
                </Panel>
              )}
            </AnimatePresence>
          ) : (
            <EndingScreen state={state} onReset={reset} />
          )}

          <p role="status" aria-live="polite" className={`min-h-[1.25rem] font-[family-name:var(--font-display)] text-[15px] italic text-ember ${shadow}`}>
            {message}
          </p>
        </div>
      </div>

      <AnimatePresence>{brief && <Brief onBegin={begin} />}</AnimatePresence>
    </main>
  );
}

/* ---------- typewriter: gives the interrogator a voice ---------- */
function Typewriter({ text, className, speed = 26 }: { text: string; className?: string; speed?: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i % 2 === 0) sound.key();
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed, reduce]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="text-ember">▍</span>}
    </span>
  );
}

/* ---------- decrypt reveal: glyphs scramble, then lock left-to-right ---------- */
const GLYPHS = 'abcdefghijklmnopqrstuvwxyz';
function DecryptText({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduce) { setOut(text); return; }
    const settleAt = text.split('').map((_, i) => 5 + i * 1.3);
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      setOut(
        text
          .split('')
          .map((ch, i) => (ch === ' ' || ch === '“' || ch === '”' || ch === '?' ? ch : frame >= settleAt[i] ? ch : GLYPHS[Math.floor(Math.random() * 26)]))
          .join(''),
      );
      if (frame > settleAt[settleAt.length - 1]) { window.clearInterval(id); setOut(text); }
    }, 38);
    return () => window.clearInterval(id);
  }, [text, reduce]);
  return <span className={className}>{out}</span>;
}

function Brief({ onBegin }: { onBegin: () => void }) {
  const [showHow, setShowHow] = useState(false);
  const reduce = useReducedMotion();
  const story = [
    'Manchester. The longest day, 1952.',
    'They have brought you in to decide what you are.',
    'When the sun sets, they will give their answer.',
  ];
  const at = (d: number) => (reduce ? { duration: 0 } : { duration: 0.9, delay: d, ease: [0.16, 1, 0.3, 1] as const });
  const steps = [
    ['Decode', 'Each question arrives enciphered. Crack it before the sun sets. Wrong guesses cost daylight.'],
    ['Answer', 'Reply as a person to be believed. It also costs daylight. Silence is safe, but hollow.'],
    ['Survive', 'Daylight is your life. Last until dawn and you pass. Run out, and you go dark.'],
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#040308] px-6"
      role="dialog" aria-modal="true" aria-label="the night begins">
      {/* a single warm light overhead */}
      <div aria-hidden className="lamp-flicker pointer-events-none absolute left-1/2 top-0 h-[40vmin] w-[60vmin] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse 50% 80% at 50% 0%, color-mix(in oklab, #f4b258 40%, transparent), transparent 70%)' }} />
      <div className="relative flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col gap-4">
          {story.map((line, i) => (
            <motion.p key={line} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={at(0.3 + i * 1.1)}
              className="font-[family-name:var(--font-display)] text-[19px] italic leading-relaxed text-bone">
              {line}
            </motion.p>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={at(0.4 + story.length * 1.1)} className="flex flex-col gap-5">
          <div className="flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[0.32em] text-bone">PASS</h1>
            <span className="text-[11px] uppercase tracking-widest text-ash">decode · answer · survive</span>
          </div>
          <div className="flex items-center gap-5">
            <button onClick={onBegin} className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-ember px-7 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-colors hover:bg-[#ffb74d]">
              Begin the night
            </button>
            <button onClick={() => setShowHow((v) => !v)} className="text-[11px] uppercase tracking-widest text-bone-dim underline-offset-4 hover:text-bone hover:underline">
              {showHow ? 'hide' : 'how this works'}
            </button>
          </div>
          <AnimatePresence>
            {showHow && (
              <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-2 overflow-hidden border-l border-white/10 pl-4">
                {steps.map(([k, t]) => (
                  <li key={k} className="text-[13px] leading-relaxed text-bone-dim">
                    <span className="font-medium uppercase tracking-widest text-bone">{k}.</span> {t}
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Panel({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-sm bg-[rgba(10,8,14,0.66)] p-6 shadow-[0_10px_34px_rgba(0,0,0,0.45)] ring-1 ring-white/5 backdrop-blur-[3px]">
      {/* the lamp pools warm light onto the page */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-12%,rgba(244,178,88,0.11),transparent_58%)]" />
      <div className="relative flex flex-col gap-5">{children}</div>
    </motion.section>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-ash">{children}</p>
);

function Header({ state, r, muted, lowLight, onHelp, onMute }: { state: GameState; r: number; muted: boolean; lowLight: boolean; onHelp: () => void; onMute: () => void }) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <h1 className={`font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none tracking-[0.34em] text-bone ${shadow}`}>PASS</h1>
        <div className="flex items-center gap-1">
          <span className={`mr-2 font-[family-name:var(--font-sans)] text-[11px] lowercase tracking-wide text-bone-dim ${shadow}`}>
            night {state.turn} of {state.econ.turns} · {PHASE_NAME(r)}
          </span>
          <button onClick={onMute} aria-label={muted ? 'unmute' : 'mute'} className="inline-flex h-11 w-9 items-center justify-center text-bone-dim hover:text-bone">
            <span className="text-[13px]">{muted ? '🔇' : '♪'}</span>
          </button>
          <button onClick={onHelp} aria-label="how to play" className="inline-flex h-11 w-9 items-center justify-center text-bone-dim hover:text-bone">
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] ring-1 ring-white/15 hover:ring-white/40">?</span>
          </button>
        </div>
      </div>
      <div className="relative h-px w-full bg-white/10">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-ember-deep to-ember" style={{ width: `${r * 100}%`, transition: 'width 700ms ease-out' }} />
      </div>
      <div className={`flex justify-between font-[family-name:var(--font-mono)] text-[10px] text-bone-dim ${shadow}`}>
        <span className={lowLight ? 'animate-pulse text-ember' : ''}>light {state.daylight}{lowLight ? ' · failing' : ''}</span>
        <span>doubt {state.suspicion.toFixed(2)}</span>
        <span>{state.humanity.count ? `believed ${humanityAvg(state).toFixed(2)}` : 'unspoken'}</span>
      </div>
    </header>
  );
}

function Transcript({ items }: { items: Exchange[] }) {
  const recent = items.slice(-4);
  return (
    <div className="flex max-h-[28vh] flex-col gap-3 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,transparent,black_14%)]">
      <p className="text-[10px] uppercase tracking-[0.3em] text-ash">the record</p>
      {recent.map((e, i) => (
        <div key={i} className="flex flex-col gap-0.5 opacity-75">
          <p className="font-[family-name:var(--font-display)] text-[15px] italic leading-snug text-bone-dim">“{e.q}{e.press ? '' : '?'}”</p>
          <p className="text-[13px] text-bone-dim/70">{e.a === '— silence —' ? <span className="italic text-ash">— silence —</span> : `“${e.a}”`}</p>
          <p className="text-[12px] italic text-ember/70">{e.line}</p>
        </div>
      ))}
    </div>
  );
}

function VerdictBeat({ verdict, onContinue, last }: { verdict: Verdict; onContinue: () => void; last: boolean }) {
  return (
    <>
      <Label>the interrogator</Label>
      <Typewriter text={verdict.line} className="font-[family-name:var(--font-display)] text-xl italic leading-snug text-bone" />
      {verdict.tell && <p className="text-[12px] text-bone-dim">{verdict.tell}.</p>}
      <p className={`text-[11px] uppercase tracking-widest ${verdict.good ? 'text-ember' : 'text-ash'}`}>
        {verdict.skip ? 'their suspicion sharpens' : verdict.good ? 'their suspicion eases' : 'their suspicion sharpens'}
      </p>
      <button onClick={onContinue} className="inline-flex min-h-[44px] items-center justify-center self-start rounded-sm bg-ember px-5 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-colors hover:bg-[#ffb74d]">
        {last ? 'meet the morning' : 'the next question'}
      </button>
    </>
  );
}

function DecodePanel({ puzzle, hintUsed, onAttempt, onHint }: { puzzle: Puzzle; hintUsed: boolean; onAttempt: (g: string) => void; onHint: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>intercept · {CIPHER_LABEL[puzzle.cipher.type]}</Label>
        <p className="text-[12px] leading-snug text-bone-dim">{DECODE_HINT[puzzle.cipher.type]}</p>
      </div>
      <p aria-label="enciphered message" className="font-[family-name:var(--font-mono)] text-xl tracking-[0.12em] text-ember break-words">{puzzle.ciphertext}</p>
      {puzzle.cipher.type === 'caesar' ? (
        <CaesarDial puzzle={puzzle} hintUsed={hintUsed} onAttempt={onAttempt} />
      ) : puzzle.cipher.type === 'substitution' ? (
        <SubstitutionGrid puzzle={puzzle} hintUsed={hintUsed} onAttempt={onAttempt} />
      ) : (
        <TypedDecode puzzle={puzzle} hintUsed={hintUsed} onAttempt={onAttempt} />
      )}
      {!hintUsed && (
        <button onClick={onHint} className="inline-flex min-h-[44px] items-center self-start text-[11px] uppercase tracking-widest text-bone-dim underline-offset-4 hover:text-bone hover:underline">
          {HINT_LABEL[puzzle.cipher.type]}
        </button>
      )}
    </>
  );
}

function Submit({ onClick, ready }: { onClick: () => void; ready?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onClick} className={`inline-flex min-h-[44px] items-center justify-center self-start rounded-sm bg-ember px-5 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-all hover:bg-[#ffb74d] ${ready ? 'ring-2 ring-bone/70 ring-offset-2 ring-offset-transparent' : ''}`}>
        this is what they said
      </button>
      {ready && <span className="text-[11px] uppercase tracking-widest text-ember">this reads true</span>}
    </div>
  );
}

function CaesarDial({ puzzle, hintUsed, onAttempt }: { puzzle: Puzzle; hintUsed: boolean; onAttempt: (g: string) => void }) {
  const [shift, setShift] = useState(0);
  const preview = useMemo(() => decode(puzzle.ciphertext, { type: 'caesar', shift }), [puzzle, shift]);
  const answer = puzzle.cipher.type === 'caesar' ? puzzle.cipher.shift : 0;
  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" className="font-[family-name:var(--font-display)] text-lg text-bone">{preview}</p>
      {hintUsed && <p className="text-[11px] uppercase tracking-widest text-ember">the rotor rests at {answer}</p>}
      <Rotor shift={shift} onChange={setShift} />
      <Submit onClick={() => onAttempt(preview)} ready={looksEnglish(preview)} />
    </div>
  );
}

function SubstitutionGrid({ puzzle, hintUsed, onAttempt }: { puzzle: Puzzle; hintUsed: boolean; onAttempt: (g: string) => void }) {
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

  useEffect(() => { if (sel) pickerRef.current?.querySelector('button')?.focus(); }, [sel]);
  useEffect(() => {
    if (!hintUsed) return;
    setMap((m) => {
      const n = { ...m };
      let added = 0;
      for (let i = 0; i < puzzle.ciphertext.length && added < 2; i++) {
        const c = puzzle.ciphertext[i];
        if (c !== ' ' && !n[c]) { n[c] = puzzle.plaintext[i]; added++; }
      }
      return n;
    });
  }, [hintUsed, puzzle]);

  const cipherLetters = useMemo(() => Array.from(new Set(puzzle.ciphertext.replace(/ /g, '').split(''))), [puzzle]);
  const previewChars = puzzle.ciphertext.split('');

  function assign(plain: string) {
    if (!sel || locked[sel]) return;
    sound.key();
    setMap((m) => {
      const n = { ...m };
      for (const k in n) if (n[k] === plain && !locked[k]) delete n[k];
      n[sel] = plain;
      return n;
    });
    setSel(null);
  }

  const guess = previewChars.map((c) => (c === ' ' ? ' ' : map[c] ?? '·')).join('');

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" aria-label={`decoded so far: ${guess.replace(/·/g, 'blank')}`} className="font-[family-name:var(--font-display)] text-lg tracking-wide">
        {previewChars.map((c, i) => (c === ' ' ? ' ' : (
          <span key={i} className={map[c] ? 'text-bone' : 'text-ash/60'}>{map[c] ?? '·'}</span>
        )))}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="enciphered letters">
        {cipherLetters.map((c) => (
          <button key={c} disabled={!!locked[c]} aria-pressed={sel === c}
            aria-label={locked[c] ? `${c}, fixed as ${locked[c]}` : map[c] ? `${c}, read as ${map[c]}` : `${c}, unread`}
            onClick={() => { setSel(c); sound.tick(); }}
            className={`h-11 w-11 rounded-sm font-[family-name:var(--font-mono)] text-sm transition-colors ${
              locked[c] ? 'bg-ember-deep/30 text-ember' : sel === c ? 'bg-ember text-ink ring-2 ring-bone' : 'bg-white/[0.07] text-bone-dim hover:bg-white/15'
            }`}>
            {map[c] ?? c}
          </button>
        ))}
      </div>
      {sel && (
        <div ref={pickerRef} role="group" aria-label={`choose a letter for ${sel}`} className="flex flex-wrap gap-1">
          {ALPHABET.map((p) => (
            <button key={p} onClick={() => assign(p)} className="h-9 w-9 rounded-sm bg-white/[0.04] font-[family-name:var(--font-mono)] text-xs text-bone-dim hover:bg-ember hover:text-ink">{p}</button>
          ))}
        </div>
      )}
      <Submit onClick={() => onAttempt(guess)} ready={looksEnglish(guess)} />
    </div>
  );
}

function TypedDecode({ puzzle, hintUsed, onAttempt }: { puzzle: Puzzle; hintUsed: boolean; onAttempt: (g: string) => void }) {
  const [val, setVal] = useState('');
  const opening = puzzle.plaintext.split(' ').slice(0, 3).join(' ');
  return (
    <div className="flex flex-col gap-4">
      {puzzle.revealedKey && (
        <p className="text-[11px] uppercase tracking-widest text-ash">the key, at last. <span className="font-[family-name:var(--font-mono)] text-ember">{puzzle.revealedKey}</span></p>
      )}
      {hintUsed && <p className="text-[11px] uppercase tracking-widest text-ember">it opens: “{opening}…”</p>}
      <input id="decode" name="decode" value={val} onChange={(e) => setVal(e.target.value)} aria-label="your decoding" placeholder="set down the line they spoke…"
        className="min-h-[44px] rounded-sm bg-black/40 px-4 py-3 font-[family-name:var(--font-display)] text-lg text-bone outline-none ring-1 ring-white/10 placeholder:text-ash/60" />
      <Submit onClick={() => onAttempt(val)} ready={looksEnglish(val)} />
    </div>
  );
}

function ReplyPanel({ question, pressing = false, loading = false, judging, onReply, onSkip }: { question: string; pressing?: boolean; loading?: boolean; judging: boolean; onReply: (t: string) => void; onSkip: () => void }) {
  const [val, setVal] = useState('');
  if (loading) {
    return (
      <>
        <Label>they lean in close</Label>
        <p className="font-[family-name:var(--font-display)] text-xl italic text-bone-dim">…</p>
      </>
    );
  }
  return (
    <>
      <Label>{pressing ? 'they press' : 'decoded · they ask'}</Label>
      {pressing ? (
        <Typewriter text={`“${question}”`} className="font-[family-name:var(--font-display)] text-2xl italic leading-snug text-ember" />
      ) : (
        <DecryptText text={`“${question}?”`} className="font-[family-name:var(--font-display)] text-2xl italic leading-snug text-bone" />
      )}
      <p className="text-[12px] text-bone-dim">{pressing ? 'They did not buy it. Answer again, truer this time. It costs light.' : 'Answer as a person to be believed (it costs light), or stay silent and keep what you have.'}</p>
      <textarea id="reply" name="reply" value={val} onChange={(e) => setVal(e.target.value)} disabled={judging} rows={2} aria-label="your reply"
        placeholder="say something a person would say…"
        className="resize-none rounded-sm bg-black/40 px-4 py-3 text-[15px] text-bone outline-none ring-1 ring-white/10 placeholder:text-ash/60 disabled:opacity-50" />
      <div className="flex items-center gap-5">
        <button disabled={judging || !val.trim()} onClick={() => onReply(val)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-ember px-5 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-colors hover:bg-[#ffb74d] disabled:bg-white/10 disabled:text-ash">
          {judging ? 'they consider…' : 'speak'}
        </button>
        <button disabled={judging} onClick={onSkip} className="inline-flex min-h-[44px] items-center text-[11px] uppercase tracking-widest text-bone-dim underline-offset-4 hover:text-bone hover:underline disabled:opacity-40">
          stay silent
        </button>
      </div>
    </>
  );
}

const ENDINGS: Record<string, { title: string; line: string }> = {
  A: { title: 'You passed the night.', line: 'Not survived. Believed. They let you walk into the morning.' },
  B: { title: 'You passed the night.', line: 'You survived it. They never quite believed you.' },
  C: { title: 'You outlasted the dark.', line: 'On logic alone. No one ever knew you at all.' },
  OFF: { title: 'Switched off.', line: 'The light failed in the middle of a word.' },
};

function EndingScreen({ state, onReset }: { state: GameState; onReset: () => void }) {
  const e = ENDINGS[state.ending ?? 'OFF'];
  const won = state.status === 'won';
  const reduce = useReducedMotion();
  const fade = (d: number) => (reduce ? { duration: 0 } : { duration: 0.9, delay: d, ease: [0.16, 1, 0.3, 1] as const });
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
      className="flex flex-1 flex-col items-start justify-center gap-7 py-10">
      {/* the horizon: a line of dawn if you survived, cold ash if you went dark */}
      <motion.div initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={fade(0.2)}
        className="h-[2px] w-full"
        style={{ transformOrigin: 'left', background: won ? 'linear-gradient(90deg,#f0a338,transparent)' : 'linear-gradient(90deg,#39323f,transparent)', boxShadow: won ? '0 0 26px 2px rgba(240,163,56,0.45)' : 'none' }} />

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(0.5)} className="text-[11px] uppercase tracking-[0.3em] text-ash">
        {won ? 'dawn breaks' : 'the room goes quiet'}
      </motion.p>

      <div className="flex flex-col gap-3">
        <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={fade(0.7)} className="font-[family-name:var(--font-display)] text-3xl text-bone">{e.title}</motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(1.1)} className="max-w-sm text-[15px] leading-relaxed text-bone-dim">{e.line}</motion.p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(1.9)} className="max-w-md border-t border-white/10 pt-6">
        <p className="font-[family-name:var(--font-display)] text-[15px] italic leading-relaxed text-bone-dim">
          The test you sat tonight was imagined by a man who spent his life being tested. Inspired by the work of Alan Turing.
        </p>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[13px] text-ember">For Alan Turing · 1912–1954</p>
      </motion.div>

      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(2.6)} onClick={onReset}
        className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-ember px-6 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-colors hover:bg-[#ffb74d]">
        another night
      </motion.button>
    </motion.section>
  );
}
