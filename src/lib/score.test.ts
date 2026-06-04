import { describe, it, expect } from 'vitest';
import { scoreReply } from './score';

describe('offline humanity scorer (fallback judge)', () => {
  it('a skipped/empty reply scores 0', () => {
    expect(scoreReply('').score).toBe(0);
    expect(scoreReply('   ').score).toBe(0);
  });

  it('a hedging, first-person, sensory reply reads human (>= 0.6)', () => {
    const r = scoreReply('honestly i think i fear the dark, it reminds me of my mother and rain');
    expect(r.score).toBeGreaterThanOrEqual(0.6);
  });

  it('a long, formal, contraction-free reply reads robotic (< 0.45)', () => {
    const r = scoreReply(
      'The longest day represents the maximum duration of solar illumination available to an observer.'
    );
    expect(r.score).toBeLessThan(0.45);
  });

  it('a one-word reply is penalized for being too terse', () => {
    expect(scoreReply('yes').score).toBeLessThan(0.6);
  });

  it('always returns a non-empty tell and a clamped score', () => {
    for (const t of ['', 'maybe i dunno', 'I am a fully operational unit.']) {
      const r = scoreReply(t);
      expect(r.tell.length).toBeGreaterThan(0);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic', () => {
    expect(scoreReply('i guess i feel cold')).toEqual(scoreReply('i guess i feel cold'));
  });
});
