/**
 * Offline humanity scorer — the FALLBACK judge.
 *
 * When Gemini is unavailable (no key, quota dead, network down, or the judge is
 * just playing the demo build), this keeps the reply mechanic alive. It is a
 * coarse heuristic: it cannot match Gemini's discrimination, which is exactly
 * why DEFAULT_ECON's Ending-A threshold sits at 0.75 (see game.ts). The Gemini
 * path (gemini.ts) returns the same shape so the two are interchangeable.
 */

export interface ReplyScore {
  score: number; // 0..1 — how human the reply reads
  tell: string; // the one-line "tell" shown to the player
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function scoreReply(reply: string): ReplyScore {
  const text = reply.trim();
  if (!text) return { score: 0, tell: 'said nothing — the silence itself is a tell' };

  const lower = text.toLowerCase();
  const has = (re: RegExp) => re.test(lower);
  const words = text.split(/\s+/).length;

  let s = 0.5;
  const tells: string[] = [];

  if (words >= 5 && words <= 28) s += 0.1;
  else if (words < 5) {
    s -= 0.15;
    tells.push('too clipped — humans ramble');
  } else {
    s -= 0.15;
    tells.push('over-long, like a prepared statement');
  }

  if (has(/\b(maybe|i think|kind of|sort of|dunno|honestly|i guess|i feel|not sure)\b/)) {
    s += 0.15;
    tells.push('it hedges — that reads human');
  }
  if (has(/\b(i|my|me|i'm|i've|i'd)\b/)) s += 0.1;
  if (has(/'(s|t|m|ve|re|ll|d)\b/)) s += 0.08;
  else tells.push('not one contraction — stiff');
  if (has(/\d|warm|cold|smell|hands|mother|rain|window|afraid|quiet|light|dark/)) {
    s += 0.1;
    tells.push('a specific, sensory detail');
  }

  // too-perfect penalty: long + fully punctuated + zero contractions
  if (words >= 12 && /[.?!]$/.test(text) && !/'(s|t|m|ve|re|ll|d)\b/.test(text)) {
    s -= 0.2;
    tells.push('too composed — a machine over-explains');
  }

  return {
    score: clamp01(s),
    tell: tells[0] ?? 'hard to read — flat, neither warm nor cold',
  };
}
