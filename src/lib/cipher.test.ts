import { describe, it, expect } from 'vitest';
import {
  encode,
  decode,
  roundTrips,
  makeSubstitution,
  type CipherSpec,
} from './cipher';

describe('caesar', () => {
  const spec: CipherSpec = { type: 'caesar', shift: 5 };

  it('encodes a known vector', () => {
    expect(encode('the longest day', spec)).toBe('ymj qtsljxy ifd');
  });

  it('preserves spaces and lowercases input', () => {
    expect(encode('A B', { type: 'caesar', shift: 1 })).toBe('b c');
  });

  it('wraps z -> a', () => {
    expect(encode('z', { type: 'caesar', shift: 1 })).toBe('a');
  });

  it('round-trips any shift', () => {
    for (let s = 0; s < 26; s++) {
      const sp: CipherSpec = { type: 'caesar', shift: s };
      expect(decode(encode('do you dream', sp), sp)).toBe('do you dream');
    }
  });
});

describe('vigenere', () => {
  const spec: CipherSpec = { type: 'vigenere', key: 'sun' };

  it('round-trips', () => {
    expect(decode(encode('the longest day', spec), spec)).toBe('the longest day');
  });

  it('key advances only on letters, not spaces', () => {
    // 'ab' with key 'b' (shift 1 each) -> 'bc'; the space must not consume key
    expect(encode('a a', { type: 'vigenere', key: 'b' })).toBe('b b');
  });
});

describe('substitution', () => {
  it('round-trips a generated mapping', () => {
    const map = makeSubstitution(42);
    const spec: CipherSpec = { type: 'substitution', map };
    expect(decode(encode('what do you fear', spec), spec)).toBe('what do you fear');
  });

  it('makeSubstitution returns a 26-letter permutation', () => {
    const map = makeSubstitution(7);
    expect(map).toHaveLength(26);
    expect(new Set(map.split('')).size).toBe(26);
  });

  it('is deterministic per seed', () => {
    expect(makeSubstitution(7)).toBe(makeSubstitution(7));
  });
});

describe('roundTrips guard (never trust an external cipher spec)', () => {
  it('returns true for a valid spec', () => {
    expect(roundTrips('what does the longest day mean', { type: 'caesar', shift: 9 })).toBe(true);
  });

  it('returns false for a broken substitution map (not a permutation)', () => {
    const bad: CipherSpec = { type: 'substitution', map: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' };
    expect(roundTrips('hello', bad)).toBe(false);
  });
});
