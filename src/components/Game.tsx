'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useAnimationControls } from 'motion/react';
import {
  createGame,
  attemptDecode,
  useHint,
  recordReply,
  advance,
  skipReply,
  humanityAvg,
  type GameState,
  type NextQuestion,
} from '@/lib/game';
import { pickQuestion, difficultyFor } from '@/lib/puzzle';
import { decode } from '@/lib/cipher';
import { scoreReply } from '@/lib/score';
import { interrogatorLine, pressLine } from '@/lib/lines';
import { CIPHER_LEARN, interceptFor, ABOUT } from '@/lib/history';
import { sound } from '@/lib/sound';
import Scene from '@/components/Scene';
import Rotor from '@/components/Rotor';
import TellMeter from '@/components/TellMeter';
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

type Persona = 'patient' | 'hard';
type Verdict = { line: string; tell: string; good: boolean; humanScore: number; skip: boolean; question: string; replyText: string; contradiction: string; persona: Persona };
type Exchange = { q: string; a: string; line: string; press: boolean };

// Two interrogators share the table. The hard one steps forward as their doubt rises;
// the patient one holds the chair while you are still being given rope. Driven by
// suspicion, so the shift is earned by how the night is going — not random.
const HARD_AT = 0.45;
const personaFor = (suspicion: number): Persona => (suspicion >= HARD_AT ? 'hard' : 'patient');
const PERSONA_NAME: Record<Persona, string> = { patient: 'Margery', hard: 'Holt' };
const PERSONA_ROLE: Record<Persona, string> = { patient: 'the patient one', hard: 'the hard one' };

const PLAY_URL = 'pass-game-elizabeth-emersons-projects.vercel.app';
const SAVE_KEY = 'pass:save:v1';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dailySeed() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
function nightLabelFor() {
  const d = new Date();
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export default function Game() {
  const [seed, setSeed] = useState(1);
  const [nightLabel, setNightLabel] = useState('');
  const [state, setState] = useState<GameState>(() => createGame({ seed: 1 }));
  const [judging, setJudging] = useState(false);
  const [message, setMessage] = useState('');
  const [brief, setBrief] = useState(true);
  const [about, setAbout] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pressing, setPressing] = useState<string | null>(null); // null = not pressing; '' = loading; else the follow-up
  const [pressed, setPressed] = useState(false);
  const [transcript, setTranscript] = useState<Exchange[]>([]);
  const [dossier, setDossier] = useState<{ classification: string; note: string; recommendation: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [blackout, setBlackout] = useState(false); // the switch-off: a hard cut to dark when the light fails
  const reduce = useReducedMotion();
  const shake = useAnimationControls();
  const jolt = (i: number) => {
    if (reduce) return;
    shake.start({ x: [0, -i, i * 0.8, -i * 0.55, i * 0.3, 0], transition: { duration: 0.34, ease: 'easeOut' } });
  };
  const flash = useAnimationControls();
  const dread = () => {
    if (reduce) return;
    flash.start({ opacity: [0, 0.5, 0], transition: { duration: 0.8, ease: 'easeOut' } });
  };

  const r = clampR(state.daylight / state.econ.start);
  const skyTop = tri(r, '#1b3a5c', '#2a2540', '#080610');
  const skyBot = tri(r, '#c8773c', '#74383a', '#140f1c');
  const sunCol = tri(r, '#ffd98a', '#e07b38', '#3a2030');
  const ease1200 = reduce ? 'none' : '1200ms ease-out';

  useEffect(() => { sound.ambient(r); }, [r]);
  useEffect(() => {
    if (state.status === 'lost') {
      sound.switchOff();
      jolt(11);
      setBlackout(true); // hard cut to dark; the verdict fades up behind it
      const t = window.setTimeout(() => setBlackout(false), reduce ? 400 : 1500);
      return () => window.clearTimeout(t);
    }
    if (state.status === 'won') sound.verdict(true);
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps
  // when the night ends, the interrogator files a case-file verdict on your whole performance
  useEffect(() => {
    if (state.status === 'playing' || dossier) return;
    const t = transcript.map((e) => `Q: ${e.q}\nA: ${e.a}`).join('\n\n');
    (async () => {
      try {
        const res = await fetch('/api/casefile', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ transcript: t, outcome: state.ending, believed: humanityAvg(state) }),
        });
        const j = await res.json();
        setDossier({ classification: j.classification, note: j.note, recommendation: j.recommendation });
      } catch {
        /* ending still renders without it */
      }
    })();
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps
  // the clock: ticks faster as the light fails — urgency without a real-time death
  useEffect(() => {
    if (state.status !== 'playing' || brief) return;
    const period = 360 + r * 1500;
    const id = window.setInterval(() => sound.clock(), period);
    return () => window.clearInterval(id);
  }, [r, state.status, brief]);

  const lowLight = r < 0.28;

  // resume today's in-progress night across a reload (the biggest "lost progress" risk)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && s.seed === dailySeed() && s.state?.status === 'playing') {
        setSeed(s.seed);
        setState(s.state);
        setTranscript(s.transcript ?? []);
        setDossier(s.dossier ?? null);
        setNightLabel(s.nightLabel ?? nightLabelFor());
        setBrief(false);
      }
    } catch {
      /* no save, or unreadable — start fresh */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // persist the night as it unfolds
  useEffect(() => {
    if (brief) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ seed, state, transcript, dossier, nightLabel }));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [state, transcript, dossier, brief, seed, nightLabel]);

  // ---- Gemini-authored questions, prefetched a turn ahead so the latency hides
  // behind the current decode + reply. The CIPHER is always built locally; only
  // the question TEXT comes from Gemini. Falls back to the offline bank silently:
  // we only inject when the route reports source 'gemini', otherwise the pure
  // game core picks the same bank question it always would.
  const nextQRef = useRef<{ turn: number; q: NextQuestion } | null>(null);
  const prefetchingRef = useRef<number | null>(null);
  // Once Gemini signals a rate limit, stop spending quota on the LUXURY call
  // (question variety) and reserve what's left for the visible AI — the judge,
  // the press, the contradiction, the case-file. The bank covers the questions.
  const aiThrottledRef = useRef(false);
  async function prefetchNext(curTurn: number, suspicion: number) {
    const target = curTurn + 1;
    if (target >= state.econ.turns) return; // the final turn keeps its authored question
    if (aiThrottledRef.current) return; // quota is tight; let the bank serve questions
    if (nextQRef.current?.turn === target || prefetchingRef.current === target) return;
    prefetchingRef.current = target;
    try {
      const res = await fetch('/api/question', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          seed,
          turn: target,
          theme: pickQuestion(seed, target).theme,
          difficulty: difficultyFor(target, suspicion),
        }),
      });
      const j = await res.json();
      if (j.rateLimited) aiThrottledRef.current = true; // back off; conserve quota for the judge
      if (j.source === 'gemini' && j.plaintext) {
        nextQRef.current = { turn: target, q: { plaintext: j.plaintext, themeTag: j.themeTag } };
      }
    } catch {
      /* offline / failed -> bank fallback handles the next turn */
    } finally {
      if (prefetchingRef.current === target) prefetchingRef.current = null;
    }
  }
  /** Hand the prefetched question for `target` to the reducer, if it is ready. */
  function takeNext(target: number): NextQuestion | undefined {
    const held = nextQRef.current;
    if (held?.turn === target) {
      nextQRef.current = null;
      return held.q;
    }
    return undefined;
  }
  // kick off the prefetch for the upcoming turn as soon as a new turn opens
  useEffect(() => {
    if (state.status !== 'playing' || brief) return;
    prefetchNext(state.turn, state.suspicion);
  }, [state.turn, state.status, brief]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin() {
    const s = dailySeed();
    setSeed(s);
    setNightLabel(nightLabelFor());
    setState(createGame({ seed: s }));
    nextQRef.current = null;
    prefetchingRef.current = null;
    aiThrottledRef.current = false;
    sound.init();
    sound.startDrone();
    setBrief(false);
  }
  function reset() {
    const s = seed + 1; // a fresh night on replay
    setSeed(s);
    setState(createGame({ seed: s }));
    nextQRef.current = null;
    prefetchingRef.current = null;
    aiThrottledRef.current = false;
    setMessage('');
    setVerdict(null);
    setPressing(null);
    setPressed(false);
    setTranscript([]);
    setDossier(null);
  }
  function onAttempt(guess: string) {
    const next = attemptDecode(state, guess);
    if (next === state) return;
    if (next.phase === 'replying') sound.resolved();
    else if (next.status !== 'lost') { sound.tick(); jolt(5); } // wrong guess: a small jolt
    setMessage(next.phase === 'decoding' && next.status === 'playing' ? `Not yet. The light slips. (−${state.econ.wrong})` : '');
    setState(next);
  }
  async function onReply(text: string) {
    const q = pressing ?? state.puzzle.plaintext;
    const persona = personaFor(state.suspicion);
    const recentTranscript = transcript.slice(-5).map((e) => `They asked: "${e.q}" — the subject said: "${e.a}"`).join('\n');
    setJudging(true);
    let humanScore: number, tell: string, line: string, contradiction = '';
    try {
      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, reply: text, recentTranscript, persona }),
      });
      const j = await res.json();
      if (j.rateLimited) aiThrottledRef.current = true; // judge is rate-limited: stop prefetching questions
      humanScore = j.humanScore;
      tell = j.tell;
      line = j.line || interrogatorLine(j.humanScore, text.length);
      contradiction = j.contradiction || '';
    } catch {
      const h = scoreReply(text);
      humanScore = h.score;
      tell = h.tell;
      line = interrogatorLine(h.score, text.length);
    }
    setJudging(false);
    const good = humanScore >= 0.45 && !contradiction;
    sound.verdict(good);
    if (contradiction) dread();
    setVerdict({ line, tell, good, humanScore, skip: false, question: q, replyText: text, contradiction, persona });
  }
  function onSkip() {
    sound.verdict(false);
    setVerdict({ line: interrogatorLine(0, state.turn), tell: '', good: false, humanScore: 0, skip: true, question: pressing ?? state.puzzle.plaintext, replyText: '', contradiction: '', persona: personaFor(state.suspicion) });
  }
  async function resolveVerdict() {
    if (!verdict) return;
    const v = verdict;
    const wasPress = pressing !== null;
    sound.tick();
    setVerdict(null);
    setMessage('');
    setTranscript((t) => [...t, { q: v.question, a: v.skip ? '— silence —' : v.replyText, line: v.line, press: wasPress }]);

    const next = v.skip ? skipReply(state, takeNext(state.turn + 1)) : recordReply(state, v.humanScore);
    if (next.suspicion > state.suspicion + 0.001) dread(); // their doubt rises — the room reddens
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
      const pressMemory = transcript.slice(-5).map((e) => `They asked: "${e.q}" — the subject said: "${e.a}"`).join('\n');
      try {
        const res = await fetch('/api/press', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: v.question, reply: v.replyText, recentTranscript: pressMemory, persona: v.persona }),
        });
        const j = await res.json();
        setPressing(j.followup || pressLine(v.replyText.length));
      } catch {
        setPressing(pressLine(v.replyText.length));
      }
      return;
    }
    // otherwise the night moves on
    setState(advance(next, takeNext(next.turn + 1)));
    setPressing(null);
    setPressed(false);
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden"
      style={{ background: `linear-gradient(${skyTop} 0%, ${skyBot} 100%)`, transition: `background ${ease1200}` }}>
      <Scene r={r} suspicion={state.suspicion} skyTop={skyTop} skyBot={skyBot} sunCol={sunCol} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0"
        style={{ background: 'linear-gradient(to bottom, rgba(6,5,10,.55) 0%, transparent 15%, transparent 60%, rgba(8,6,12,.7) 100%)' }} />
      <motion.div aria-hidden initial={{ opacity: 0 }} animate={flash} className="pointer-events-none absolute inset-0 z-10"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(140,20,20,0.6) 100%)' }} />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-6 py-10 sm:py-14">
        <motion.div animate={shake} aria-hidden={brief} className={`flex w-full max-w-[34rem] flex-col gap-8 transition-opacity duration-500 ${brief ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
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
                  <DecodePanel puzzle={state.puzzle} hintUsed={state.hintUsed} coach={state.turn === 1} onAttempt={onAttempt} onHint={() => { sound.key(); setState(useHint(state)); }} />
                </Panel>
              ) : (
                <Panel key={pressing !== null ? `p${transcript.length}` : `r${state.turn}`} reduce={!!reduce}>
                  <ReplyPanel
                    question={pressing !== null ? pressing : state.puzzle.plaintext}
                    pressing={pressing !== null}
                    loading={pressing === ''}
                    judging={judging}
                    coach={state.turn === 1 && pressing === null}
                    onReply={onReply}
                    onSkip={onSkip}
                  />
                </Panel>
              )}
            </AnimatePresence>
          ) : (
            <EndingScreen state={state} nightLabel={nightLabel} caseNo={seed} dossier={dossier} onReset={reset} onAbout={() => setAbout(true)} />
          )}

          <p role="status" aria-live="polite" className={`min-h-[1.25rem] font-[family-name:var(--font-display)] text-[15px] italic text-ember ${shadow}`}>
            {message}
          </p>
        </motion.div>
      </div>

      <AnimatePresence>{brief && <Brief onBegin={begin} onAbout={() => setAbout(true)} />}</AnimatePresence>
      <AnimatePresence>{about && <About onClose={() => setAbout(false)} />}</AnimatePresence>

      {/* the switch-off: a CRT power-down when the light fails — hard snap to black,
          a single collapsing scanline, then the dark lifts onto the verdict. */}
      <AnimatePresence>
        {blackout && (
          <motion.div key="blackout" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 0.12, ease: 'easeIn' }}
            className="pointer-events-none fixed inset-0 z-[60] bg-black">
            {!reduce && (
              <motion.div
                initial={{ scaleX: 1, opacity: 0 }}
                animate={{ scaleX: [1, 1, 0.04], opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.55, times: [0, 0.25, 1], ease: 'easeOut', delay: 0.08 }}
                className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2"
                style={{ background: 'linear-gradient(90deg, transparent, #f4b258 35%, #fff6e0 50%, #f4b258 65%, transparent)', transformOrigin: 'center' }} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function About({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
      className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[rgba(4,3,8,0.94)] px-6 py-12 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="about alan turing">
      <div className="flex w-full max-w-lg flex-col gap-5">
        <p className="text-[10px] uppercase tracking-[0.3em] text-ash">in memory</p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-bone">Alan Turing · 1912–1954</h2>
        {ABOUT.body.map((p, i) => (
          <p key={i} className="text-[14px] leading-relaxed text-bone-dim">{p}</p>
        ))}
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-4">
          {ABOUT.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-ember underline-offset-4 hover:underline">{l.label}</a>
          ))}
        </div>
        <button onClick={onClose} className="inline-flex min-h-[44px] items-center self-start text-[11px] uppercase tracking-widest text-bone-dim underline-offset-4 hover:text-bone hover:underline">
          close
        </button>
      </div>
    </motion.div>
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

function Brief({ onBegin, onAbout }: { onBegin: () => void; onAbout: () => void }) {
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
      className="absolute inset-0 z-20 flex items-center justify-center px-6"
      role="dialog" aria-modal="true" aria-label="the night begins"
      style={{ background: 'linear-gradient(to bottom, rgba(6,5,12,0.28) 0%, rgba(5,4,10,0.58) 48%, rgba(4,3,8,0.88) 100%)' }}>
      {/* the room itself shows through (full daylight, sun high) — the night has not started.
          a soft text scrim keeps the copy readable over the window + lamp behind it. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-1/3"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 38% 72%, rgba(4,3,8,0.62), transparent 72%)' }} />
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
            <button onClick={onAbout} className="text-[11px] uppercase tracking-widest text-bone-dim underline-offset-4 hover:text-bone hover:underline">
              the history
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
      {/* the vise: daylight closes from the left, the interrogator's doubt from the right */}
      <div className="relative h-[2px] w-full bg-white/10">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-ember-deep to-ember" style={{ width: `${r * 100}%`, transition: 'width 700ms ease-out' }} />
        <div className={`absolute inset-y-0 right-0 bg-gradient-to-l from-[#a3302a] to-[#d9483c] ${state.suspicion > 0.6 ? 'animate-pulse' : ''}`} style={{ width: `${state.suspicion * 100}%`, transition: 'width 500ms ease-out' }} />
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

/* The two interrogators as ink busts, rim-lit by the lamp — same SVG/CSS noir
   language as the room (no raster art). Holt is hard angles + a fedora; Margery
   is softer, hair pinned up. Small, beside the name they speak under. */
function Portrait({ persona }: { persona: Persona }) {
  const ink = '#0d0b14';
  const rim = persona === 'hard' ? 'rgba(228,86,72,0.85)' : 'rgba(247,196,118,0.85)';
  const sw = 1.3;
  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12 shrink-0 rounded-full ring-1 ring-white/15" aria-hidden
      style={{ background: 'radial-gradient(circle at 50% 14%, rgba(244,178,88,0.16), rgba(6,5,12,0.9) 70%)' }}>
      {persona === 'hard' ? (
        <g fill={ink} stroke={rim} strokeWidth={sw} strokeLinejoin="round">
          {/* square shoulders */}
          <path d="M7 56 V49 Q7 40 18 38 H38 Q49 40 49 49 V56 Z" />
          {/* head */}
          <rect x="20.5" y="23" width="15" height="17.5" rx="4.5" />
          {/* fedora crown + brim */}
          <path d="M21.5 23 Q21.5 13.5 28 13.5 Q34.5 13.5 34.5 23 Z" />
          <ellipse cx="28" cy="23" rx="16.5" ry="3.3" />
        </g>
      ) : (
        <g fill={ink} stroke={rim} strokeWidth={sw} strokeLinejoin="round">
          {/* soft shoulders */}
          <path d="M11 56 V51 Q11 42 22 40 H34 Q45 42 45 51 V56 Z" />
          {/* hair sweeping the head */}
          <path d="M16.5 33 Q15.5 17.5 28 17.5 Q40.5 17.5 39.5 33 Q39 26 34.5 23.5 H21.5 Q17 26 16.5 33 Z" />
          {/* pinned bun */}
          <circle cx="28" cy="15" r="3.4" />
          {/* face */}
          <ellipse cx="28" cy="31" rx="7.2" ry="9.2" />
        </g>
      )}
    </svg>
  );
}

function VerdictBeat({ verdict, onContinue, last }: { verdict: Verdict; onContinue: () => void; last: boolean }) {
  return (
    <>
      {verdict.contradiction && (
        <div className="rounded-sm border border-[#a3302a]/50 bg-[#a3302a]/10 p-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#d9483c]">caught in a contradiction</p>
          <p className="mt-1 text-[13px] italic leading-relaxed text-bone-dim">But a moment ago you said: &ldquo;{verdict.contradiction}&rdquo;</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Portrait persona={verdict.persona} />
        <span className={`text-[10px] font-medium uppercase tracking-[0.32em] ${verdict.persona === 'hard' ? 'text-[#d9483c]' : 'text-ember/80'}`}>
          {PERSONA_NAME[verdict.persona]} · {PERSONA_ROLE[verdict.persona]}
        </span>
      </div>
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

function DecodePanel({ puzzle, hintUsed, coach = false, onAttempt, onHint }: { puzzle: Puzzle; hintUsed: boolean; coach?: boolean; onAttempt: (g: string) => void; onHint: () => void }) {
  const [showLearn, setShowLearn] = useState(false);
  return (
    <>
      {coach && (
        <p className="rounded-sm border-l-2 border-ember/60 bg-ember/[0.06] px-3 py-2 text-[12px] leading-relaxed text-bone-dim">
          <span className="font-medium text-ember">First, decode.</span> Their question came in scrambled. Turn the dial below until the line reads as real English, then confirm it. A wrong guess costs daylight, and daylight is your life.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label>intercept · {CIPHER_LABEL[puzzle.cipher.type]}</Label>
          <button onClick={() => setShowLearn((v) => !v)} className="text-[10px] uppercase tracking-widest text-ash underline-offset-4 hover:text-bone-dim hover:underline">
            what is this?
          </button>
        </div>
        <p className="text-[12px] leading-snug text-bone-dim">{DECODE_HINT[puzzle.cipher.type]}</p>
        <AnimatePresence>
          {showLearn && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-l border-ember/30 pl-3 text-[12px] italic leading-relaxed text-ash">
              {CIPHER_LEARN[puzzle.cipher.type]}
            </motion.p>
          )}
        </AnimatePresence>
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
      {/* a discovered fragment of the real history, one per night */}
      <p className="border-t border-white/5 pt-3 text-[12px] italic leading-relaxed text-ash/80">{interceptFor(puzzle.turn)}</p>
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

/* ---------- the interrogator weighing you: an intentional wait beat ---------- */
function Considering() {
  const reduce = useReducedMotion();
  return (
    <div role="status" aria-label="the interrogator is considering your answer" className="flex items-center gap-3 py-1">
      <span className="flex items-end gap-[3px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ember"
            animate={reduce ? { opacity: 0.6 } : { opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          />
        ))}
      </span>
      <span className="text-[11px] uppercase tracking-[0.3em] text-ash">they weigh your answer</span>
    </div>
  );
}

function ReplyPanel({ question, pressing = false, loading = false, judging, coach = false, onReply, onSkip }: { question: string; pressing?: boolean; loading?: boolean; judging: boolean; coach?: boolean; onReply: (t: string) => void; onSkip: () => void }) {
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
      {coach && (
        <p className="rounded-sm border-l-2 border-ember/60 bg-ember/[0.06] px-3 py-2 text-[12px] leading-relaxed text-bone-dim">
          <span className="font-medium text-ember">Now answer.</span> The interrogator is a real AI, and it is deciding whether you sound human. Reply like a person would — short, specific, a little uncertain. Or stay silent: safe, but it tells them nothing and the doubt grows.
        </p>
      )}
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
      {judging ? <Considering /> : <TellMeter text={val} />}
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

function EndingScreen({ state, nightLabel, caseNo, dossier, onReset, onAbout }: { state: GameState; nightLabel: string; caseNo: number; dossier: { classification: string; note: string; recommendation: string } | null; onReset: () => void; onAbout: () => void }) {
  const e = ENDINGS[state.ending ?? 'OFF'];
  const won = state.status === 'won';
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  function share() {
    const survived = won ? state.econ.turns : state.turn;
    const believed = state.humanity.count ? `, believed ${humanityAvg(state).toFixed(2)}` : '';
    const verdict = dossier ? `\nVerdict: ${dossier.classification}.` : '';
    const result = `PASS · case no. ${caseNo} · the night of ${nightLabel || 'the solstice'}\n${won ? `I passed. Lasted ${survived}/${state.econ.turns}` : `I went dark on night ${survived}/${state.econ.turns}`}${believed}.${verdict}\n${PLAY_URL}`;
    navigator.clipboard?.writeText(result).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }
  const fade = (d: number) => (reduce ? { duration: 0 } : { duration: 0.9, delay: d, ease: [0.16, 1, 0.3, 1] as const });
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
      className="flex flex-1 flex-col items-start justify-center gap-7 py-10">
      {/* dawn actually breaks: a warm light climbs the whole room when you survive the night
          (full-bleed, behind the play surface, slow rise — the payoff the dark scene withholds) */}
      {won && (
        <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(0.6)}
          className="pointer-events-none fixed inset-0 -z-0"
          style={{ background: 'radial-gradient(120% 80% at 50% 118%, rgba(245,179,88,0.30) 0%, rgba(224,123,56,0.12) 34%, transparent 64%)' }} />
      )}
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

      {dossier && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={fade(1.5)}
          className="w-full max-w-md rounded-sm border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-ash">case file · no. {caseNo}</p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[13px] tracking-wide text-ember">{dossier.classification}</p>
          <p className="mt-2 text-[13px] italic leading-relaxed text-bone-dim">{dossier.note}</p>
          <p className="mt-2 text-[12px] text-ash">Recommendation: {dossier.recommendation}</p>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(1.9)} className="flex max-w-md flex-col gap-3 border-t border-white/10 pt-6">
        <p className="font-[family-name:var(--font-display)] text-[15px] italic leading-relaxed text-bone-dim">
          {won ? 'The interrogation you survived' : 'The interrogation that put your light out'} is the test he invented. In 1952 he sat on the other side of it. He answered their questions honestly, and he was not believed.
        </p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(3.0)} className="font-[family-name:var(--font-display)] text-[15px] italic leading-relaxed text-bone">
          You spent tonight as a machine, trying to pass. So did he.
        </motion.p>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[13px] text-ember">For Alan Turing · 1912–1954</p>
        <button onClick={onAbout} className="mt-3 text-[11px] uppercase tracking-widest text-bone-dim underline-offset-4 hover:text-bone hover:underline">
          read his story
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(2.6)} className="flex items-center gap-5">
        <button onClick={onReset}
          className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-ember px-6 font-[family-name:var(--font-sans)] text-sm font-medium text-ink transition-colors hover:bg-[#ffb74d]">
          another night
        </button>
        <button onClick={share}
          className="inline-flex min-h-[44px] items-center text-[11px] uppercase tracking-widest text-bone-dim underline-offset-4 hover:text-bone hover:underline">
          {copied ? 'copied to clipboard' : 'share your night'}
        </button>
      </motion.div>
    </motion.section>
  );
}
