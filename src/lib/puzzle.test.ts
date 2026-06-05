import { describe, it, expect } from 'vitest';
import { roundTrips } from './cipher';
import { buildPuzzle, pickQuestion, QUESTIONS, type Puzzle } from './puzzle';

const allTurns = (turns = 9) =>
  Array.from({ length: turns }, (_, i) => i + 1);

describe('question bank', () => {
  it('every question is short (<= 10 words) and lowercase-ish', () => {
    for (const q of QUESTIONS) {
      expect(q.text.split(/\s+/).length).toBeLessThanOrEqual(10);
      expect(q.text).toBe(q.text.toLowerCase());
    }
  });

  it('pickQuestion is deterministic per (seed, turn)', () => {
    expect(pickQuestion(123, 3)).toEqual(pickQuestion(123, 3));
  });

  it('pickQuestion varies across turns for a seed', () => {
    const picks = allTurns().map((t) => pickQuestion(99, t).text);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });
});

describe('buildPuzzle — every generated puzzle is solvable', () => {
  it('round-trips for all turns x several suspicion levels x seeds', () => {
    for (const seed of [1, 42, 777]) {
      for (const susp of [0, 0.3, 0.6, 1]) {
        for (const turn of allTurns()) {
          const p = buildPuzzle({ seed, turn, suspicion: susp });
          expect(roundTrips(p.plaintext, p.cipher), `turn ${turn} susp ${susp}`).toBe(true);
        }
      }
    }
  });

  it('is fully deterministic per (seed, turn, suspicion)', () => {
    const a = buildPuzzle({ seed: 5, turn: 4, suspicion: 0.4 });
    const b = buildPuzzle({ seed: 5, turn: 4, suspicion: 0.4 });
    expect(a).toEqual(b);
  });

  it('accepts an externally supplied plaintext (the Gemini path) but builds the cipher locally', () => {
    const p = buildPuzzle({ seed: 1, turn: 2, suspicion: 0, plaintext: 'do you fear the dark' });
    expect(p.plaintext).toBe('do you fear the dark');
    expect(roundTrips(p.plaintext, p.cipher)).toBe(true);
  });

  it('the last turn is the authored unanswerable question (default 8 turns)', () => {
    expect(buildPuzzle({ seed: 1, turn: 8, suspicion: 0 }).plaintext).toBe('if you could choose to feel pain would you');
  });

  it('the final question tracks totalTurns, not a hardcoded 8', () => {
    const p = buildPuzzle({ seed: 1, turn: 5, suspicion: 0, totalTurns: 5 });
    expect(p.plaintext).toBe('if you could choose to feel pain would you');
  });

  it('an injected plaintext still overrides on the final turn (client never injects there)', () => {
    const p = buildPuzzle({ seed: 1, turn: 8, suspicion: 0, plaintext: 'what is your name' });
    expect(p.plaintext).toBe('what is your name');
  });
});

describe('cadence (interleaved so no long same-cipher run)', () => {
  const P = (turn: number): Puzzle => buildPuzzle({ seed: 1, turn, suspicion: 0.2 });

  it('night 1 teaches the rotor (caesar), night 2 the grid (substitution)', () => {
    expect(P(1).cipher.type).toBe('caesar');
    expect(P(2).cipher.type).toBe('substitution');
  });

  it('the cipher type varies every night (no two-in-a-row of the same)', () => {
    for (let t = 1; t < 8; t++) {
      expect(P(t).cipher.type).not.toBe(P(t + 1).cipher.type);
    }
  });

  it('every substitution turn carries pre-revealed letters (cuts the grind)', () => {
    expect(P(2).prefilled.length).toBeGreaterThan(0);
    expect(P(4).prefilled.length).toBeGreaterThan(0);
  });

  it('night 8 is the climactic vigenere', () => {
    expect(P(8).cipher.type).toBe('vigenere');
  });

  it('caesar turns have no prefilled help', () => {
    expect(P(1).prefilled.length).toBe(0);
    expect(P(3).prefilled.length).toBe(0);
  });
});
