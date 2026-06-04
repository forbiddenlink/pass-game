# Prototype verdict — night-loop

**Question:** Does the de-risked PASS night loop feel fun? (objective daylight fail state +
decode-as-spine + optional human-reply for score, AI-judge removed from the kill path.)

**Run:** `pnpm prototype` (or `node prototype/night-loop.prototype.mjs`)

**Verdict (2026-06-03, via `node prototype/sim.mjs` — readline pipe-race made
multi-turn interactive auto-testing unreliable, so a pure-economy sim drives it):**

**YES — the de-risked loop has a real game in it, AFTER one fix.**

The fix the prototype forced: in the first draft, replies cost ZERO daylight, so
replying was free upside and skipping was never a real choice — the "optional reply"
was fake and the soul mechanic was dead weight. **Fix: replies cost daylight too.**
Now daylight is a currency spent on SURVIVAL (decode) vs IDENTITY (reply). That is
the game's central decision, every turn.

Sim results (START=100, decode -10, reply -8, wrong -6, 5 turns):
- bank-it-all → LIVE @50, humanity 0.00, Ending C (safe, hollow)
- be-believed → LIVE @10, humanity 0.89, Ending A (survive tight, high score)
- sloppy+chatty (1 miss/turn + reply all) → DEAD turn 5
- greedy (2 miss + reply) → DEAD turn 4
Conclusion: you cannot both fumble decodes AND reply every turn; death is objective;
the reply decision is genuine. **Greenlight the build.**

Open knobs for real-build playtest:
- Heuristic scorer barely separates robotic (0.68) from human (0.89) — the real Gemini
  judge must discriminate harder, or raise Ending-A threshold to ~0.75.
- "be believed" survives at exactly 10 — one decode miss = death while replying all.
  Consider START≈110 or reply cost 6 so skilled play has a little slack.
- 5 turns felt right for a sim; confirm against the 4-6 min target with real decode UX.

Things to feel for:
- Does spending daylight on wrong decodes create real tension, or just annoyance?
- Is "reply is optional" satisfying, or does skipping feel like the obvious correct play (and thus the reply mechanic is pointless)?
- Does suspicion → harder-cipher read as a fair consequence?
- Right number of turns? (proto uses 5.) Right daylight budget? (proto uses 100, base -10/turn, -6/wrong.)
- Is decode-as-spine enough of a *game*, or still thin without the reply stakes?

**If the loop is dull here, it will be dull with a shader. Decide BEFORE committing the 14-day build.**
