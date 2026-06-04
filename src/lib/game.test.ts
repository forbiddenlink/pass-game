import { describe, it, expect } from 'vitest';
import {
  createGame,
  attemptDecode,
  useHint,
  submitReply,
  skipReply,
  DEFAULT_ECON,
  type GameState,
} from './game';

const solve = (s: GameState) => attemptDecode(s, s.puzzle.plaintext);

/** Drive a full night: decode correctly each turn, then run `onReply`. */
function playNight(opts: { onReply: (s: GameState) => GameState; seed?: number; econ?: typeof DEFAULT_ECON }) {
  let s = createGame({ seed: opts.seed ?? 1, econ: opts.econ });
  let guard = 0;
  while (s.status === 'playing' && guard++ < 100) {
    s = solve(s); // -> replying (assuming alive)
    if (s.phase === 'replying') s = opts.onReply(s);
  }
  return s;
}

describe('createGame', () => {
  it('starts on turn 1, decoding, full daylight, with a solvable puzzle', () => {
    const s = createGame({ seed: 1 });
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('decoding');
    expect(s.daylight).toBe(DEFAULT_ECON.start);
    expect(s.status).toBe('playing');
    expect(s.puzzle.turn).toBe(1);
  });
});

describe('decode phase', () => {
  it('wrong guess spends `wrong` daylight and stays decoding', () => {
    const s0 = createGame({ seed: 1 });
    const s1 = attemptDecode(s0, 'definitely not the answer');
    expect(s1.daylight).toBe(DEFAULT_ECON.start - DEFAULT_ECON.wrong);
    expect(s1.phase).toBe('decoding');
    expect(s1.status).toBe('playing');
  });

  it('correct guess spends `decode` daylight and moves to replying', () => {
    const s0 = createGame({ seed: 1 });
    const s1 = solve(s0);
    expect(s1.daylight).toBe(DEFAULT_ECON.start - DEFAULT_ECON.decode);
    expect(s1.phase).toBe('replying');
  });

  it('hint spends `hint` daylight', () => {
    const s0 = createGame({ seed: 1 });
    const s1 = useHint(s0);
    expect(s1.daylight).toBe(DEFAULT_ECON.start - DEFAULT_ECON.hint);
    expect(s1.hintUsed).toBe(true);
  });
});

describe('reply phase', () => {
  it('replying spends `reply` daylight, banks humanity, advances the turn', () => {
    const s = submitReply(solve(createGame({ seed: 1 })), 0.9);
    expect(s.turn).toBe(2);
    expect(s.phase).toBe('decoding');
    expect(s.humanity.count).toBe(1);
    expect(s.daylight).toBe(DEFAULT_ECON.start - DEFAULT_ECON.decode - DEFAULT_ECON.reply);
  });

  it('a robotic (low) reply raises suspicion; a human (high) one eases it', () => {
    const base = solve(createGame({ seed: 1 }));
    expect(submitReply(base, 0.2).suspicion).toBeGreaterThan(base.suspicion);
    expect(submitReply(base, 0.9).suspicion).toBeLessThanOrEqual(base.suspicion);
  });

  it('skipping costs no daylight but nudges suspicion up and advances the turn', () => {
    const base = solve(createGame({ seed: 1 }));
    const s = skipReply(base);
    expect(s.daylight).toBe(base.daylight);
    expect(s.turn).toBe(2);
    expect(s.suspicion).toBeGreaterThan(base.suspicion);
  });
});

describe('objective death (never a vibe)', () => {
  it('switches off when daylight runs out', () => {
    const econ = { ...DEFAULT_ECON, start: 12 };
    let s = createGame({ seed: 1, econ });
    s = attemptDecode(s, 'wrong'); // -7 -> 5
    s = solve(s); // -10 -> -5  => dead on a correct decode
    expect(s.status).toBe('lost');
    expect(s.ending).toBe('OFF');
    expect(s.phase).toBe('over');
  });
});

describe('endings', () => {
  it('skip every reply -> survive, Ending C (silent)', () => {
    const s = playNight({ onReply: skipReply });
    expect(s.status).toBe('won');
    expect(s.ending).toBe('C');
  });

  it('reply convincingly every turn -> Ending A (believed)', () => {
    const s = playNight({ onReply: (st) => submitReply(st, 0.9) });
    expect(s.status).toBe('won');
    expect(s.ending).toBe('A');
  });

  it('reply but only so-so -> Ending B (survived, not believed)', () => {
    const s = playNight({ onReply: (st) => submitReply(st, 0.5) });
    expect(s.status).toBe('won');
    expect(s.ending).toBe('B');
  });
});

describe('phase guards (UI safety — wrong action is a no-op)', () => {
  it('cannot reply while decoding', () => {
    const s0 = createGame({ seed: 1 });
    expect(submitReply(s0, 0.9)).toEqual(s0);
  });

  it('cannot decode while replying', () => {
    const s1 = solve(createGame({ seed: 1 }));
    expect(attemptDecode(s1, s1.puzzle.plaintext)).toEqual(s1);
  });

  it('cannot act after the game is over', () => {
    const s = playNight({ onReply: skipReply });
    expect(skipReply(s)).toEqual(s);
    expect(attemptDecode(s, 'anything')).toEqual(s);
  });
});
