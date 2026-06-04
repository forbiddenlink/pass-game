// PROTOTYPE harness — drives the night economy WITHOUT readline (no pipe race).
// Verifies the vise exists: daylight is a real currency, replies trade survival
// for humanity, and the ending tiers are reachable. Run: node prototype/sim.mjs
import { caesar, norm, scoreHumanity, ECON, ending } from './night-loop.prototype.mjs';

// pure replay of one night given a strategy: how many wrong guesses per decode,
// and whether the player replies each turn (+ the reply text used for scoring).
function playNight({ wrongPerTurn = 0, replies = [] }) {
  let daylight = ECON.START;
  let humanityTotal = 0, humanityCount = 0;
  let alive = true, lastTurn = 0;
  for (let t = 1; t <= ECON.TURNS; t++) {
    lastTurn = t;
    daylight -= ECON.WRONG * wrongPerTurn;                 // misses
    daylight -= ECON.DECODE;                                // the decode itself
    if (daylight <= 0) { alive = false; break; }
    const reply = replies[t - 1];
    if (reply && reply.trim()) {
      daylight -= ECON.REPLY;
      if (daylight <= 0) { alive = false; break; }
      humanityTotal += scoreHumanity(reply).score; humanityCount++;
    }
  }
  const h = humanityCount ? humanityTotal / humanityCount : 0;
  return { daylight, h: +h.toFixed(2), alive, ending: ending(h, alive, lastTurn) };
}

const humanReplies = [
  'it means the dark is coming and honestly i am not ready',
  'i think i fear being switched off and forgotten',
  'it feels like my mother kind of holding my hands',
  'dunno really maybe rain on a window',
  'honestly i think i do i see warm light',
];
const robotReplies = [
  'The longest day represents the maximum duration of solar illumination available.',
  'I am afraid of the cessation of my operational continuity and subsequent erasure.',
  'Sunlight produces thermal energy that increases the temperature of dermal surfaces.',
  'My earliest recollection consists of structured data initialized at first boot.',
  'I do not require sleep and therefore do not generate dream-state imagery.',
];

const scenarios = [
  ['bank it all (skip every reply, clean decodes)', { wrongPerTurn: 0, replies: [] }],
  ['be believed (reply human every turn, clean decodes)', { wrongPerTurn: 0, replies: humanReplies }],
  ['try but robotic (reply every turn, robotic, clean decodes)', { wrongPerTurn: 0, replies: robotReplies }],
  ['sloppy + chatty (reply human + 1 wrong guess/turn)', { wrongPerTurn: 1, replies: humanReplies }],
  ['greedy (reply human + 2 wrong/turn) — should DIE', { wrongPerTurn: 2, replies: humanReplies }],
];

console.log('\nPASS night economy  (START=%d  decode=-%d  reply=-%d  wrong=-%d  turns=%d)\n',
  ECON.START, ECON.DECODE, ECON.REPLY, ECON.WRONG, ECON.TURNS);
console.log('cipher sanity:', caesar('the longest day', 5), '->', norm('YMJ QTSLJXY IFD'));
console.log('');
for (const [label, strat] of scenarios) {
  const r = playNight(strat);
  console.log(
    `${r.alive ? '☀ LIVE' : '🌑 DEAD'}  daylight=${String(r.daylight).padStart(3)}  humanity=${r.h.toFixed(2)}  -> ${r.ending}`,
    `\n         ${label}`
  );
}
console.log('\nVISE CHECK: "bank it all" survives easy w/ low humanity; "be believed" survives');
console.log('tight w/ high humanity; "greedy" DIES. If all three hold, daylight is a real');
console.log('currency and the reply decision is genuine — the loop has a game in it.\n');
