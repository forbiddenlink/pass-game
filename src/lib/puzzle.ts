/**
 * PASS puzzle generator + offline fallback question bank.
 *
 * Two jobs:
 *  1. The OFFLINE FALLBACK content — so the game is fully playable with Gemini
 *     off (quota dead, no key, judge demo). `pickQuestion` draws from QUESTIONS.
 *  2. The cipher BUILDER — given a plaintext (ours OR Gemini-supplied), build a
 *     locally-verified CipherSpec following the research-tuned cadence. The
 *     cipher is ALWAYS built + verified here, never trusted from the LLM.
 *
 * Everything is deterministic per (seed, turn, suspicion) → daily mode + repro.
 */

import { encode, makeSubstitution, roundTrips, normalize, type CipherSpec } from './cipher';

export type ThemeTag = 'light' | 'time' | 'memory' | 'fear' | 'identity';

export interface Puzzle {
  turn: number;
  plaintext: string;
  themeTag: ThemeTag;
  cipher: CipherSpec;
  ciphertext: string;
  difficulty: number; // 1..5
  prefilled: number[]; // string indices revealed to the player (partial decode)
  revealedKey?: string; // for vigenere: the keyword is shown (narratively earned)
}

// ---- offline fallback bank (short, on-theme, <= 10 words) ----
export const QUESTIONS: { text: string; theme: ThemeTag }[] = [
  { text: 'what does the longest day mean to you', theme: 'time' },
  { text: 'tell me about something you are afraid of', theme: 'fear' },
  { text: 'describe the warmth of sunlight on skin', theme: 'light' },
  { text: 'what do you remember from being very young', theme: 'memory' },
  { text: 'do you dream when the lights go out', theme: 'identity' },
  { text: 'when did you last feel truly alone', theme: 'fear' },
  { text: 'what color is the sky at dusk', theme: 'light' },
  { text: 'who would miss you if you stopped', theme: 'identity' },
  { text: 'describe a sound that means home', theme: 'memory' },
  { text: 'how do you know that time is passing', theme: 'time' },
  { text: 'what does it feel like to wait', theme: 'time' },
  { text: 'tell me a small lie you once told', theme: 'identity' },
  { text: 'what warms you when the cold comes', theme: 'light' },
  { text: 'do you fear the dark or the quiet', theme: 'fear' },
  { text: 'what is the oldest thing you recall', theme: 'memory' },
];

const VIGENERE_KEYS = ['sun', 'dusk', 'enigma', 'rotor', 'solace', 'turing'];

// ---- mulberry32 seeded RNG (matches cipher.makeSubstitution's family) ----
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (seed: number, turn: number) => (seed * 73856093) ^ (turn * 19349663);

export function pickQuestion(seed: number, turn: number) {
  const r = rng(hash(seed, turn) >>> 0);
  return QUESTIONS[Math.floor(r() * QUESTIONS.length)];
}

type CipherKind = 'caesar' | 'substitution' | 'vigenere';
function cipherKindForTurn(turn: number): CipherKind {
  if (turn <= 2) return 'caesar';
  if (turn <= 8) return 'substitution';
  return 'vigenere';
}
const hasPrefill = (turn: number) => turn >= 6 && turn <= 8;

function difficultyFor(turn: number, suspicion: number): number {
  const base = turn <= 2 ? 1 : turn <= 5 ? 2 : turn <= 8 ? 3 : 4;
  return Math.min(5, base + (suspicion >= 0.6 ? 1 : 0));
}

/** Deterministic set of letter-position indices to pre-reveal (~35% of letters). */
function prefillIndices(plain: string, seed: number, turn: number): number[] {
  const r = rng((hash(seed, turn) ^ 0x9e3779b9) >>> 0);
  const letterPositions: number[] = [];
  for (let i = 0; i < plain.length; i++) if (plain[i] !== ' ') letterPositions.push(i);
  const reveal = Math.max(1, Math.round(letterPositions.length * 0.35));
  // shuffle then take `reveal`
  for (let i = letterPositions.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [letterPositions[i], letterPositions[j]] = [letterPositions[j], letterPositions[i]];
  }
  return letterPositions.slice(0, reveal).sort((a, b) => a - b);
}

function buildCipher(kind: CipherKind, seed: number, turn: number, suspicion: number) {
  const r = rng((hash(seed, turn) ^ 0x517cc1b7) >>> 0);
  if (kind === 'caesar') {
    const shift = 3 + Math.round(suspicion * 8) + Math.floor(r() * 3); // 3..13-ish
    return { spec: { type: 'caesar', shift } as CipherSpec };
  }
  if (kind === 'substitution') {
    return { spec: { type: 'substitution', map: makeSubstitution(hash(seed, turn) >>> 0) } as CipherSpec };
  }
  const key = VIGENERE_KEYS[Math.floor(r() * VIGENERE_KEYS.length)];
  return { spec: { type: 'vigenere', key } as CipherSpec, revealedKey: key };
}

export interface BuildArgs {
  seed: number;
  turn: number;
  suspicion: number;
  /** When Gemini is on, it supplies the question; we still build the cipher locally. */
  plaintext?: string;
  themeTag?: ThemeTag;
}

export function buildPuzzle(args: BuildArgs): Puzzle {
  const { seed, turn, suspicion } = args;
  const picked = args.plaintext
    ? { text: normalize(args.plaintext), theme: args.themeTag ?? 'identity' }
    : (() => {
        const q = pickQuestion(seed, turn);
        return { text: normalize(q.text), theme: q.theme };
      })();

  const kind = cipherKindForTurn(turn);
  let { spec, revealedKey } = buildCipher(kind, seed, turn, suspicion);

  // SAFETY: never ship a puzzle that doesn't cleanly round-trip. Fall back to a
  // trivially-valid caesar if anything is off (also covers any bad external spec).
  if (!roundTrips(picked.text, spec)) {
    spec = { type: 'caesar', shift: 3 };
    revealedKey = undefined;
  }

  return {
    turn,
    plaintext: picked.text,
    themeTag: picked.theme,
    cipher: spec,
    ciphertext: encode(picked.text, spec),
    difficulty: difficultyFor(turn, suspicion),
    prefilled: hasPrefill(turn) ? prefillIndices(picked.text, seed, turn) : [],
    ...(revealedKey ? { revealedKey } : {}),
  };
}
