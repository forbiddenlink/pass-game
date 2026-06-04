/**
 * PASS game state machine — pure, deterministic, framework-free.
 *
 * The whole loop as a set of pure transitions over GameState. The humanity
 * SCORE is injected at submitReply (a number 0..1) so this module has zero
 * dependency on Gemini or any heuristic — the caller (route handler or an
 * offline scorer) decides how a reply is judged. Lose state is OBJECTIVE
 * (daylight <= 0); the score only affects suspicion, humanity, and the ending.
 *
 * Ports the economy validated in prototype/sim.mjs. See design doc §3.
 */

import { normalize } from './cipher';
import { buildPuzzle, type Puzzle } from './puzzle';

export interface Econ {
  start: number;
  decode: number;
  reply: number;
  wrong: number;
  hint: number;
  turns: number;
}

// Defaults tuned for a ~9-turn, 4-6 min night. Balance knobs — adjust in playtest.
export const DEFAULT_ECON: Econ = { start: 170, decode: 10, reply: 8, wrong: 7, hint: 4, turns: 9 };

const START_SUSPICION = 0.2;
const A_THRESHOLD = 0.75; // raised per prototype finding (heuristic over-scored robots)
const SUSPICION_HUMAN_OK = 0.45;

export type Phase = 'decoding' | 'replying' | 'over';
export type Status = 'playing' | 'won' | 'lost';
export type Ending = 'A' | 'B' | 'C' | 'OFF';

export interface GameState {
  seed: number;
  econ: Econ;
  turn: number;
  phase: Phase;
  daylight: number;
  suspicion: number;
  humanity: { total: number; count: number };
  status: Status;
  ending?: Ending;
  puzzle: Puzzle;
  hintUsed: boolean;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export function humanityAvg(s: GameState): number {
  return s.humanity.count ? s.humanity.total / s.humanity.count : 0;
}

export function createGame(opts: { seed: number; econ?: Econ; suspicion0?: number }): GameState {
  const econ = opts.econ ?? DEFAULT_ECON;
  const suspicion = opts.suspicion0 ?? START_SUSPICION;
  return {
    seed: opts.seed,
    econ,
    turn: 1,
    phase: 'decoding',
    daylight: econ.start,
    suspicion,
    humanity: { total: 0, count: 0 },
    status: 'playing',
    puzzle: buildPuzzle({ seed: opts.seed, turn: 1, suspicion }),
    hintUsed: false,
  };
}

/** Apply a daylight cost; if it runs the clock out, switch off (objective loss). */
function spend(s: GameState, cost: number): GameState {
  const daylight = s.daylight - cost;
  if (daylight <= 0) {
    return { ...s, daylight: 0, status: 'lost', ending: 'OFF', phase: 'over' };
  }
  return { ...s, daylight };
}

export function attemptDecode(s: GameState, guess: string): GameState {
  if (s.phase !== 'decoding' || s.status !== 'playing') return s;
  const correct = normalize(guess) === s.puzzle.plaintext;
  const next = spend(s, correct ? s.econ.decode : s.econ.wrong);
  if (next.status !== 'playing') return next;
  return correct ? { ...next, phase: 'replying' } : next;
}

export function useHint(s: GameState): GameState {
  if (s.phase !== 'decoding' || s.status !== 'playing') return s;
  const next = spend(s, s.econ.hint);
  return next.status !== 'playing' ? next : { ...next, hintUsed: true };
}

export function submitReply(s: GameState, humanScore: number): GameState {
  if (s.phase !== 'replying' || s.status !== 'playing') return s;
  const next = spend(s, s.econ.reply);
  if (next.status !== 'playing') return next; // switched off mid-sentence
  const score = clamp01(humanScore);
  const suspicion = clamp01(s.suspicion + (score < SUSPICION_HUMAN_OK ? 0.2 : -0.05));
  return advanceTurn({
    ...next,
    suspicion,
    humanity: { total: s.humanity.total + score, count: s.humanity.count + 1 },
  });
}

export function skipReply(s: GameState): GameState {
  if (s.phase !== 'replying' || s.status !== 'playing') return s;
  return advanceTurn({ ...s, suspicion: clamp01(s.suspicion + 0.05) });
}

function advanceTurn(s: GameState): GameState {
  if (s.turn >= s.econ.turns) return finish(s);
  const turn = s.turn + 1;
  return {
    ...s,
    turn,
    phase: 'decoding',
    hintUsed: false,
    puzzle: buildPuzzle({ seed: s.seed, turn, suspicion: s.suspicion }),
  };
}

function finish(s: GameState): GameState {
  const avg = humanityAvg(s);
  const ending: Ending = s.humanity.count === 0 ? 'C' : avg >= A_THRESHOLD ? 'A' : 'B';
  return { ...s, status: 'won', ending, phase: 'over' };
}
