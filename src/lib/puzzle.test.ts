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
});

describe('cadence (interleaved so no long same-cipher run)', () => {
  const P = (turn: number): Puzzle => buildPuzzle({ seed: 1, turn, suspicion: 0.2 });

  it('turns 1-2 are caesar', () => {
    expect(P(1).cipher.type).toBe('caesar');
    expect(P(2).cipher.type).toBe('caesar');
  });

  it('turns 3-4 are substitution', () => {
    expect(P(3).cipher.type).toBe('substitution');
    expect(P(4).cipher.type).toBe('substitution');
  });

  it('turn 5 is a caesar breather between substitution runs', () => {
    expect(P(5).cipher.type).toBe('caesar');
  });

  it('every substitution turn carries pre-revealed letters (cuts the grind)', () => {
    expect(P(3).prefilled.length).toBeGreaterThan(0);
    expect(P(6).prefilled.length).toBeGreaterThan(0);
  });

  it('turn 8 is the climactic vigenere', () => {
    expect(P(8).cipher.type).toBe('vigenere');
  });

  it('caesar turns have no prefilled help', () => {
    expect(P(1).prefilled.length).toBe(0);
    expect(P(5).prefilled.length).toBe(0);
  });
});
