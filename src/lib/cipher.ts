/**
 * PASS cipher engine — the bulletproof spine.
 *
 * Pure, deterministic char-transforms. The game NEVER trusts an external
 * (LLM-supplied) ciphertext: Gemini supplies a CipherSpec (type + key), we
 * encode locally and `roundTrips` guards that decode(encode(plain)) === plain
 * before a puzzle is ever shown. See docs/plans design §4.3.
 */

const A = 'abcdefghijklmnopqrstuvwxyz';
const idx = (c: string) => A.indexOf(c);

export type CipherSpec =
  | { type: 'caesar'; shift: number }
  | { type: 'vigenere'; key: string }
  | { type: 'substitution'; map: string }; // 26-letter permutation, plaintext-indexed

/** Lowercase; keep [a-z] and spaces, drop everything else; collapse runs of space. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map each letter through `fn` (0..25 -> 0..25); spaces pass through. */
function mapLetters(text: string, fn: (i: number, letterPos: number) => number): string {
  let letterPos = 0;
  let out = '';
  for (const c of normalize(text)) {
    if (c === ' ') {
      out += ' ';
      continue;
    }
    out += A[((fn(idx(c), letterPos) % 26) + 26) % 26];
    letterPos++;
  }
  return out;
}

export function encode(text: string, spec: CipherSpec): string {
  switch (spec.type) {
    case 'caesar':
      return mapLetters(text, (i) => i + spec.shift);
    case 'vigenere': {
      const key = normalize(spec.key).replace(/ /g, '');
      if (!key) return normalize(text);
      return mapLetters(text, (i, p) => i + idx(key[p % key.length]));
    }
    case 'substitution':
      return mapLetters(text, (i) => idx(spec.map[i]));
  }
}

export function decode(text: string, spec: CipherSpec): string {
  switch (spec.type) {
    case 'caesar':
      return mapLetters(text, (i) => i - spec.shift);
    case 'vigenere': {
      const key = normalize(spec.key).replace(/ /g, '');
      if (!key) return normalize(text);
      return mapLetters(text, (i, p) => i - idx(key[p % key.length]));
    }
    case 'substitution': {
      // invert the permutation: inverse[cipherIndex] = plaintextIndex
      const inverse = new Array<number>(26).fill(-1);
      for (let i = 0; i < spec.map.length; i++) inverse[idx(spec.map[i])] = i;
      return mapLetters(text, (i) => (inverse[i] === -1 ? i : inverse[i]));
    }
  }
}

/** The guard: a spec is only usable if it cleanly round-trips the plaintext. */
export function roundTrips(plain: string, spec: CipherSpec): boolean {
  const p = normalize(plain);
  return decode(encode(p, spec), spec) === p;
}

/** Deterministic 26-letter substitution permutation from a seed (mulberry32 Fisher-Yates). */
export function makeSubstitution(seed: number): string {
  let s = seed >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = A.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}
