/**
 * The interrogator's spoken reactions — offline fallback so the verdict beat
 * has a voice even with Gemini off. When Gemini is on, its `line` is used
 * instead. Period, clipped, faintly menacing.
 */

const HIGH = [
  'Hm. A person might have said that.',
  'I almost believe you.',
  'Go on. I am listening.',
  'That has the shape of a memory.',
];
const MID = [
  'Perhaps. We will see.',
  'You hesitate well enough.',
  'I have not decided about you.',
  'Say more, then.',
];
const LOW = [
  'A machine would say exactly that.',
  'No. Try again, thing.',
  'That is not how a person answers.',
  'I am not convinced.',
];
const SILENT = [
  'Nothing? The silence tells me plenty.',
  'You keep your mouth shut. Interesting.',
  'Say nothing, then. It costs you all the same.',
];

const pick = (arr: string[], salt: number) => arr[Math.abs(Math.floor(salt)) % arr.length];

/** A reaction line for a given humanity score; `salt` (e.g. reply length) varies it. */
export function interrogatorLine(score: number, salt = 0): string {
  if (score <= 0) return pick(SILENT, salt);
  if (score >= 0.7) return pick(HIGH, salt);
  if (score >= 0.45) return pick(MID, salt);
  return pick(LOW, salt);
}

const PRESS = [
  'No. That was rehearsed. Tell me again, and mean it this time.',
  'A person would not put it like that. Try once more.',
  'You are performing for me. Drop it. Answer plainly.',
  'I do not believe you. Say something only you could say.',
  'Slower. Tell me what it actually felt like.',
];
/** The interrogator's offline follow-up when a reply rings false. */
export function pressLine(salt = 0): string {
  return pick(PRESS, salt);
}
