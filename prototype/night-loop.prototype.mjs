// PROTOTYPE — throwaway. Answers: "Does the PASS night loop feel fun?"
// Tests the DE-RISKED loop: objective daylight fail state + decode-as-spine
// + OPTIONAL human-reply for score. NO Gemini here — hardcoded question bank
// + heuristic humanity scorer. We are testing TENSION, not the AI.
// Run: node prototype/night-loop.prototype.mjs   (or: pnpm prototype)
// DELETE or absorb the verdict once answered. See NOTES.md.

import readline from 'node:readline';

// ---- tiny cipher engine (the real one will be TDD'd; this is throwaway) ----
const A = 'abcdefghijklmnopqrstuvwxyz';
export const caesar = (text, shift) =>
  text.replace(/[a-z]/g, (c) => A[(A.indexOf(c) + shift + 26) % 26]);
export const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

// ---- economy constants (single source — sim + interactive share these) ----
export const ECON = { START: 100, DECODE: 10, REPLY: 8, WRONG: 6, HINT: 4, TURNS: 5 };
export const ending = (h, alive, turn) =>
  !alive ? `C-OFF (switched off turn ${turn})`
    : h >= 0.6 ? 'A-believed' : h > 0 ? 'B-survived' : 'C-silent';

let rl;
const ask = (q) => new Promise((res) => rl.question(q, res));

// ---- night content (short, on-theme, 6-10 words) ----
const QUESTIONS = [
  'what does the longest day mean to you',
  'tell me about something you are afraid of',
  'describe the warmth of sunlight on skin',
  'what do you remember from being very young',
  'do you dream when the lights go out',
];

// ---- humanity heuristic (stand-in for Gemini judge) ----
export function scoreHumanity(reply) {
  if (!reply.trim()) return { score: 0, note: '(skipped — no reply)' };
  const words = reply.trim().split(/\s+/);
  const n = words.length;
  let s = 0.5;
  const notes = [];
  const has = (re) => re.test(reply.toLowerCase());
  if (n >= 5 && n <= 28) { s += 0.1; } else { s -= 0.15; notes.push(n < 5 ? 'too terse' : 'over-long'); }
  if (has(/\b(maybe|i think|kind of|sort of|dunno|honestly|i guess|i feel)\b/)) { s += 0.15; notes.push('hedging — human'); }
  if (has(/\b(i|my|me|i'm|i've|i'd)\b/)) { s += 0.1; notes.push('first-person'); }
  if (has(/'(s|t|m|ve|re|ll|d)\b/)) { s += 0.08; notes.push('contractions'); }
  if (has(/\d|warm|cold|smell|hands|mother|rain|window|afraid|quiet/)) { s += 0.1; notes.push('specific/sensory'); }
  // too-perfect penalty: long, fully punctuated, zero contractions
  if (n > 14 && /[.?!]$/.test(reply.trim()) && !/'(s|t|m|ve|re|ll|d)\b/.test(reply)) { s -= 0.2; notes.push('too composed — robotic'); }
  s = Math.max(0, Math.min(1, s));
  return { score: s, note: notes.join(', ') || '(flat)' };
}

// ---- state ----
let daylight = ECON.START;
const TURNS = QUESTIONS.length;
let suspicion = 0.2;        // raises cipher difficulty; never instakills
let humanityTotal = 0;
let humanityCount = 0;

const bar = (val, max, w = 24, full = '█', empty = '░') => {
  const f = Math.round((Math.max(0, val) / max) * w);
  return full.repeat(f) + empty.repeat(Math.max(0, w - f));
};
const sun = () => {
  const pct = daylight / 100;
  if (pct > 0.75) return '☀️  high sun';
  if (pct > 0.5) return '🌤️  afternoon';
  if (pct > 0.25) return '🌇  low amber';
  if (pct > 0) return '🌆  blood dusk';
  return '🌑  dark';
};

function showState(turn) {
  console.log('\n' + '─'.repeat(50));
  console.log(`NIGHT ${turn}/${TURNS}   ${sun()}`);
  console.log(`daylight  [${bar(daylight, 100)}] ${daylight}`);
  console.log(`suspicion [${bar(suspicion, 1, 24, '▓', '░')}] ${suspicion.toFixed(2)}  (higher = harder ciphers)`);
  console.log(`humanity   ${humanityCount ? (humanityTotal / humanityCount).toFixed(2) : '—'}`);
  console.log('─'.repeat(50));
}

async function runTurn(i) {
  const turn = i + 1;
  showState(turn);

  const plain = QUESTIONS[i];
  // difficulty from suspicion: shift grows, partial decode help shrinks
  const shift = 3 + Math.round(suspicion * 9);              // 3..12
  const cipher = caesar(plain, shift);
  const partialHint = turn >= 4;                            // research cadence: ease later turns

  console.log(`\nINTERROGATOR (enciphered):  ${cipher}`);
  if (partialHint) console.log(`hint: first word decodes to "${plain.split(' ')[0]}"`);
  console.log(`(decode the sentence. wrong guesses cost daylight. type 'hint' for the shift.)`);

  let solved = false;
  while (!solved) {
    if (daylight <= 0) return false;
    const guess = await ask('your decode > ');
    if (norm(guess) === 'hint') {
      daylight -= ECON.HINT;
      console.log(`  → shift is ${shift}. (-${ECON.HINT} daylight)`);
      continue;
    }
    if (norm(guess) === norm(plain)) {
      daylight -= ECON.DECODE;                               // base turn cost
      console.log(`  ✓ decoded. (-${ECON.DECODE} daylight)`);
      solved = true;
    } else {
      daylight -= ECON.WRONG;                                // wrong-guess penalty (objective pressure)
      console.log(`  ✗ not it. (-6 daylight)  [plaintext was: "${plain}"]? type again or 'hint'`);
      // after one miss, reveal plaintext so we test the LOOP not vocabulary
      console.log(`  (prototype mercy: answer is "${plain}" — type it to continue)`);
    }
  }

  // OPTIONAL reply — depth + score, NEVER a fail state
  console.log(`\n"${plain}?"`);
  const reply = await ask('your reply (or ENTER to skip) > ');
  const { score, note } = scoreHumanity(reply);
  if (reply.trim()) {
    daylight -= ECON.REPLY;                                 // replies cost daylight — the core tradeoff
    humanityTotal += score; humanityCount++;
    console.log(`  you speak. (-${ECON.REPLY} daylight)`);
    console.log(`  interrogator reads you: humanity ${score.toFixed(2)} — ${note}`);
    if (score < 0.45) {
      suspicion = Math.min(1, suspicion + 0.2);
      console.log(`  → suspicion rises. next cipher tightens.`);
    } else {
      suspicion = Math.max(0, suspicion - 0.05);
    }
  } else {
    console.log(`  you say nothing. (safe, but no humanity earned — lesser ending)`);
    suspicion = Math.min(1, suspicion + 0.05);
  }
  return true;
}

async function main() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== PASS — night-loop prototype ===');
  console.log('You are Unit. Decoding is survival; it spends daylight. Replying as a human is OPTIONAL and ALSO spends daylight — it buys humanity (score + the fuller ending), but the dark is the only thing that kills you. Spend your light: stay alive, or be believed.\n');

  for (let i = 0; i < TURNS; i++) {
    const alive = await runTurn(i);
    if (!alive || daylight <= 0) {
      console.log(`\n🌑 The light fails mid-sentence. Switched off at turn ${i + 1}.`);
      console.log(`final humanity: ${humanityCount ? (humanityTotal / humanityCount).toFixed(2) : '0.00'}`);
      rl.close();
      return;
    }
  }

  const h = humanityCount ? humanityTotal / humanityCount : 0;
  console.log(`\n☀️ You survived the night. The sun finally sets — and rises.`);
  console.log(`daylight banked: ${daylight}   humanity: ${h.toFixed(2)}`);
  if (h >= 0.6) console.log(`\nENDING A (full): you didn't just survive — you were believed.\n"For Alan Turing, 1912–1954."`);
  else if (h > 0) console.log(`\nENDING B (partial): you survived, but they never quite believed you.\n"For Alan Turing, 1912–1954."`);
  else console.log(`\nENDING C (silent): you outlasted the dark on logic alone. No one knew you at all.\n"For Alan Turing, 1912–1954."`);
  rl.close();
}

// run interactively only when invoked directly (sim imports the pure helpers)
if (process.argv[1] && process.argv[1].endsWith('night-loop.prototype.mjs')) main();
