# PASS — a solstice interrogation

**Design doc** · 2026-06-03 · DEV June Solstice Game Jam 2026
**Working title:** `PASS` (alts: *The Longest Night*, *Nightingale*, *Imitation*, *Bombe*)
**Why "PASS":** triple meaning — pass the test / a machine passing as human / passing as "safe." Short, brandable, thematically exact.

---

## 1. One-line pitch

A turn-based interrogation game: you are a machine that must **decode** your interrogator's questions and **encode** replies that pass as human — before the solstice sun finally sets. The interrogator is Gemini. A Turing Test, inside a game about Turing.

> **⚠️ POSITIONING (research-critical).** The bare "talk your way past an AI / reverse Turing test" loop is **saturated post-2023** (AImong Us, Human or Not, Suck Up!, *Larp As AI* hit HN front page Mar 2026). Judges are tired of it as a *headline*. **Never lead the pitch with "reverse Turing test."** Lead with the three things research found are genuinely fresh and have no prior art: **(1) cipher/code-breaking fused into the loop, (2) Alan Turing's biography as the mechanical + emotional spine, (3) "switched off at sunrise" existential stakes on a solstice clock.** The chat loop is the delivery mechanism, not the sell. Headline = *"An Alan Turing tribute with cipher mechanics and a solstice countdown."*

## 2. Why this wins (prize-category stacking)

The jam has three stackable prize surfaces. Most entrants hit one. PASS hits all three, each *essential to the core loop*, not bolted on:

| Category | How PASS earns it | Bolted-on test |
|---|---|---|
| **Main theme (solstice / light / time)** | The countdown IS the longest day draining to dark. Lose = sunrise switch-off. Light is the literal life bar. | Remove the clock → no stakes. Passes. |
| **Best Ode to Alan Turing** | Literal Turing Test as mechanic + cipher code-breaking (Bletchley) + halting-uncertainty + a hybrid ending dedicated to Turing. | Remove Turing framing → game is meaningless. Passes hard. |
| **Best Google AI Usage** | Gemini IS the interrogator and the judge of whether you "pass." Schema-constrained persona + verdict per turn. | Remove Gemini → there is no opponent. Passes hard. |

Research finding (DEV jam winners): *breadth across all judging criteria beats being flashiest in one*, and *theme-as-mechanic beats theme-as-skin*. PASS is engineered for breadth: it scores on Relevance (3 themes), Creativity (novel fusion, zero prior art found), Technical Execution (Gemini structured output doing real work + shader), Writing (the post + the ending), and two bonus categories.

**Originality:** research swept itch.io + Steam + queer game jams. Turing + solstice + Pride + Gemini-as-interrogator = *no existing entry found*. The single most original concept on the table.

---

## 3. Core loop

One screen. One night. Turn-based. A full run is **4–6 minutes** (research: winning jam games are completable in 2–5 min; we sit just above for emotional arc).

```
┌─ SOLSTICE CLOCK (light bar, drains each turn) ─────────────┐
│                                                            │
│  INTERROGATOR (Gemini):                                    │
│   "Q7 ·  Wkh orqjhvw gdb — zkdw grhv lw phdq wr brx?"      │  ← DECODE
│                                                            │
│  [ decode panel: shift-cipher grid, you crack the key ]    │
│   → "The longest day — what does it mean to you?"          │
│                                                            │
│  YOUR REPLY (free text, you write it):                     │
│   [ "It means the dark is coming, and I am not ready." ]    │  ← ENCODE/PASS
│                                                            │
│  Gemini verdict (hidden meter): HUMAN 0.71 ▲  suspicion ▼  │
└────────────────────────────────────────────────────────────┘
```

**Two ciphers, every turn — the "imitation game" doubled:**

1. **DECODE (input cipher):** The interrogator's question arrives enciphered (escalating: Caesar → substitution → Vigenère → a light Enigma-rotor variant). You crack it with an interactive grid. This is the Bletchley / code-breaking beat. Gemini *generates* the question + cipher params via structured output.

2. **ENCODE / PASS (output scoring — optional depth, NOT the lose trigger):** You *may* write a free-text human reply. Gemini, in character, scores how human it reads — warmth, hesitation, contradiction, specificity. Too perfect = robotic. The score feeds your **Humanity rating** (leaderboard + ending) and nudges suspicion (→ harder *next* cipher), but a bad reply never kills you. This is the Turing Test beat and the part no hardcoded logic can fake — kept essential to the *experience and score*, removed from the *fail state*.

**Decode cadence (research-tuned — do NOT full-decode every turn; it goes stale by turn 6):**
- **Turns 1–2:** full decode, Caesar, short message (5–8 words). Teaches the UI.
- **Turns 3–5:** full decode, substitution cipher, messages stay short. The meat.
- **Turns 6–8:** **partial pre-decode** — 3–4 letters pre-filled, player completes the rest. Faster, keeps agency.
- **Turns 9–10:** one climactic full decode (Vigenère, but only with a narratively-revealed keyword so it isn't opaque) **or** skip decode entirely for the ending beat so resolution doesn't drag.
- **Rule:** never introduce a *new* cipher type in the final third (players are in resolution mode, not learning mode). Messages **6–10 words max**, always.

**Decode UX (the make-or-break for fun-vs-homework):**
- **Auto-propagate** — map one ciphertext letter → all instances update instantly across the message. The #1 lever; turns decoding into a cascading "aha." Build first.
- **Tap-to-fill, not type** — tap a cipher slot, pick from an always-visible 26-letter grid.
- **Caesar/rotor = a drag-dial** as the actual UI; watch the message unlock in real time.
- **Passive frequency hints** (ambient letter counts), never a gated/spent hint.
- **Near-miss signal** — once ~70% decodes to English-looking text, a subtle "almost there" glow. Cuts abandonment without giving the answer.

**Win/lose — OBJECTIVE (revised 2026-06-03, the de-risk that makes this shippable):**

The original design made an LLM's subjective "did that feel human" the *lose condition*. That's a fairness minefield no prompt fully clears — a losable game judged on vibes feels broken, not hard. **Fix: the lose condition is now objective; the AI-judge is demoted to score + depth.**

- **Daylight is the only fail state, and it's deterministic.** Every action spends daylight. **Wrong decode guesses cost more daylight** (objective, legible — you see the sun drop). Run out before you finish the night's decodes → switched off. No arbitrary AI kill.
- **Decode is the spine.** Cracking each ciphered question is the primary, objectively-checkable mechanic. This is the *game*.
- **The human-reply is optional depth, not life-or-death — and it ALSO costs daylight.** You *may* answer each question; speaking spends light (thinking = the sun moving). Gemini scores how human it reads → a **Humanity score** that (a) ranks you on the leaderboard, (b) unlocks the fuller ending, and (c) feeds an objective consequence: a low/robotic score raises suspicion → the *next cipher* is harder. Suspicion never instant-kills. You can skip replies and win on pure code-breaking; you just score lower and get the lesser ending.

**This is the core decision, every turn: spend daylight on SURVIVAL (decode) or on IDENTITY (reply).** Bank your light and live cheap but hollow; spend it to be believed and survive on a knife-edge.

This kills both big risks at once: **no "the AI cheated me" deaths** (fairness), and **one clear primary mechanic** instead of two competing for attention (muddiness). Decode = the game; reply = the soul + the score.

**Validated economy (prototype `prototype/sim.mjs`, 2026-06-03):** START 100, decode −10, reply −8, wrong guess −6, 5 turns. Proven: *bank-it-all* survives at 50 (Ending C, humanity 0); *reply-every-turn* survives at exactly 10 (Ending A, humanity ~0.9); *miss decodes AND reply* → objective death. The vise is real — daylight is a genuine currency, not a theme. (Knobs for build playtest: raise Ending-A threshold to ~0.75 since a soft heuristic over-scored robotic replies — the real Gemini judge must discriminate harder; consider START≈110 so one miss while replying isn't instant death. See `prototype/NOTES.md`.)

---

## 4. The Gemini interrogator (heart of the game)

Turn-based, single call per beat → latency (600ms–2s on Gemini 2.5 Flash) is invisible behind a "…the interrogator considers" animation. Research confirms this pattern is the *solid* one for a 2-week build.

### 4.1 Two structured calls per turn

**Call A — generate the question (front-loaded, can batch):**

```ts
// model: gemini-2.5-flash  (NOT -flash-image; that breaks structured output)
// responseMimeType: "application/json", responseSchema:
{
  turn: number,
  plaintext: string,        // the human-readable question
  cipher: {
    type: "caesar" | "substitution" | "vigenere" | "rotor",
    key: string,            // shift / mapping / keyword / rotor wiring
    ciphertext: string      // Gemini renders it; we VERIFY locally (see 4.3)
  },
  theme_tag: "light" | "time" | "memory" | "fear" | "identity",
  difficulty: 1 | 2 | 3 | 4 | 5
}
```

**Call B — judge the player's reply (per submission):**

```ts
{
  human_score: number,        // 0..1  — how human it reads
  suspicion_delta: number,    // -0.2..+0.3
  tell: string,               // the "tell" the interrogator noticed (shown as flavor)
  in_character_line: string,  // interrogator's spoken reaction
  verdict: "press" | "satisfied" | "alarmed"
}
```

### 4.2 Persona & prompt design
- System prompt: a 1952-coded interrogator — clipped, courteous, menacing. Hidden agenda: *decide if this is a machine.* Personality persists across turns (research: judges rewarded persona persistence in NPC-dialogue winners). We pass a compact transcript each turn (last 3 exchanges, not full history → keeps tokens + latency low).
- Difficulty ramps: cipher complexity ↑ and the interrogator's questions get more *psychologically* probing (small talk → memory → fear → "prove you felt that").

### 4.3 Reliability gaps & mitigations (don't skip)
- **Cipher correctness:** never trust the LLM's `ciphertext`. Gemini supplies `type`+`key`+`plaintext`; **we encipher locally in TS and verify** the decode path round-trips. If mismatch → re-encipher ourselves. (LLMs are unreliable at char-level transforms.)
- **Latency spikes (2.7s+ under load):** cache the *next* question during the current turn (front-load Call A). Player never waits on decode.
- **API down / rate-limited / no key:** ship a **deterministic offline fallback** — a hand-authored bank of 12 questions + ciphers, and a heuristic reply-judge (length, hedging words, specificity, perplexity proxy). Game stays fully playable with Gemini off. This also lets the *judge play it instantly* even if our quota is exhausted on submission day. **Critical for jam reliability.**
- **Cost:** ~2 calls/turn × ~10 turns = ~20 calls/run, Flash pricing → fractions of a cent. Server-side, rate-limited per IP.
- **Safety:** all Gemini calls go through a Next.js route handler. **API key never reaches the client.** Per-session rate limit. Reject/sanitize reply text length.

### 4.4 Making the verdict feel FAIR (the single biggest design risk — research-hardened)

If the reply-judge feels arbitrary, trust collapses and the game dies. Mitigations, in priority order:
- **Temperature 0.0–0.1 on the judge call.** Same reply → same score on a retest. Players test phrases; wild variance = instant distrust.
- **Explicit rubric in the system prompt**, not "does this sound human?" Scored checklist: *naturalness of phrasing, plausible emotional register, believable knowledge gaps/imperfection, specificity.* Rubric prompts cut score variance more than any other single change.
- **Few-shot anchors** — 2 examples each of *clearly suspicious / borderline / passes cleanly*, with text + score. +25–30% consistency vs zero-shot.
- **Forgiveness curve** — first 3–4 turns use a lenient threshold so the player learns the rubric through play before punishment feels earned.
- **Show the "tell," but validate it** — display the interrogator's one-line reason ("too composed; humans hedge"). Legibility makes a verdict feel earned even when the player disagrees. **Gotcha:** LLM stated reasoning can be unfaithful to the actual score — in the schema, force `tell` to be derived from the same call as `human_score`, and sanity-check (don't show "sounds natural" alongside a high-suspicion verdict).
- **Kill verbosity bias** — LLM judges over-reward length. Add "Do NOT favor longer responses" to the prompt; humans here often answer tersely.
- **Phrasing-sensitivity guard** — on borderline scores (0.4–0.6), run the judge twice and average to damp arbitrary word-order swings.

---

## 5. The solstice clock & light system (theme + wow)

- The background is a **WebGL/Canvas shader sky** that travels from blazing solstice midday → amber → blood dusk → black over the run. Each turn advances the sun. This is the *light bar* — diegetic, not a UI gauge.
- Visual wow lives here: a real-time gradient/sky shader (cheap, one fragment shader) + grain + a low sun that sinks. Reduced-motion mode swaps to a static stepped gradient.
- Audio: a drone that detunes as light fails; a single struck note on each verdict; silence + a switch-click on loss.

---

## 6. The hybrid ending (the gut-punch)

You play as **"Unit"** the entire game — pure allegory, no real-world trauma depicted. On surviving the night:

1. The interrogator concedes; the sun finally sets and *rises* — you passed.
2. Screen reframes: the transcript you just lived is intercut with the line *"This test was invented by a man who spent his life being tested."*
3. Dedication card: **"For Alan Turing. 1912–1954."** + one quiet factual line (the Turing Test origin; persecution implied, never exploited).
4. Your transcript is saved (Neon) and added to the public **Hall of the Passed** (Algolia-searchable).

On loss: the switch-off is abrupt; a softer card invites a retry. Tone stays respectful, never punitive about the real history.

Research note: the twist *is* a wow-factor and resolves the Pride/Turing tribute tastefully — concealment-as-survival by metaphor, reveal by dedication. Zero depiction of 1952 events.

### 6.1 Tone discipline (research-hardened — get this exactly right or it backfires)

The "passing" metaphor is scholarly-grounded: Turing's 1950 imitation game was *itself* a gender-performance test (Slate, "The Original Turing Test Was a Drag Show"). But there's one real trap and a clear do/don't list.

**The one risk to engineer around:** if the player *succeeds by deceiving*, it can imply queerness = deception by nature. **Fix the framing: the machine hides because the world punishes it, not because hiding is what it is.** Passing = survival under threat, never the character's essence. The **system is the antagonist**, never the player's identity.

**DO:**
- Play allegory (Unit); reveal Turing **only at the end** as resonance, not a "gotcha."
- Humble card: *"Dedicated to Alan Turing, 1912–1954."* + one factual line. Say **"inspired by," never "the story of."**
- Be transparent in the devlog that this is a jam entry **and** a sincere tribute — the DEV community respects that; hiding the contest reads as exploitative.
- Cite **Andrew Hodges, *Alan Turing: The Enigma*** on the game page; link one LGBTQ+ org (GLAAD / Stonewall) in the footer.

**DON'T:**
- Depict prosecution, chemical castration, or his death as **mechanics or imagery** — that's trauma-as-gameplay (the exact criticism of the 2014 film).
- Use his name/face *inside* the game — allegory protects you; biography would obligate full representation you can't do in 2 weeks.
- Make the dedication the *marketing hook* ("a Pride tribute!!!"). Let it be a quiet card.
- Foreground suffering without interiority (martyr-symbol) — the film's mistake.

Gold standard to emulate: *Tell Me Why* (GLAAD consulted, identity woven in from concept). Cautionary tale: *The Imitation Game* film (trauma as spectacle, sexuality sanitized, queerness as late twist).

---

## 7. Neon + Algolia (sponsors — made essential, not decorative)

Both sponsor integrations earn their place in the loop, not as checkboxes:

- **Neon (Postgres):**
  - `runs` — every completed/failed run: seed, turns survived, final suspicion, the full transcript (player replies + interrogator lines + tells), timestamp, anon handle.
  - `daily_seed` — one shared solstice interrogation per day (deterministic seed) → a *daily mode* + leaderboard, the format research shows drives DEV virality (share-your-result) without being a saturated Wordle clone.
  - Leaderboard query: longest survival / lowest suspicion for today's seed.
- **Algolia (search):** the **Hall of the Passed** — every survivor's transcript is indexed. Players search human replies that *passed* ("show me how others answered 'prove you felt fear'"). This is genuinely useful + on-theme (studying how others imitate humanity) and gives the game a social/replay layer. Facets: theme_tag, difficulty, turns_survived.

Both are removable-test-positive: pull Neon → no daily/leaderboard/Hall; pull Algolia → no study mode. They add a real second loop (play → study how others passed → play better).

---

## 8. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19 + TS** | Your daily stack + Trace muscle memory; route handlers hide the Gemini key |
| Styling | **Tailwind v4** + CSS vars for the day→night palette | Fast, themable by clock phase |
| Motion | **Framer Motion** | Typewriter reveals, suspicion shake, verdict beats |
| Atmosphere | **Canvas/WebGL fragment shader** (solstice sky) | The visual wow; one shader, cheap |
| AI | **Gemini 2.5 Flash** via `@google/genai`, `responseSchema` | Structured output = reliable puzzle + verdict (98.5% schema compliance in testing) |
| DB | **Neon (Postgres)** + Drizzle | Runs, daily seed, leaderboard |
| Search | **Algolia** | Hall of the Passed |
| Host | **Vercel** (+ note: Gemini callable from a **Cloud Run** function as the "Google AI" infra flex if time) | One-click deploy; judges play in-browser |
| Audio | Howler.js or raw WebAudio | Drone + verdict notes |
| Cipher engine | hand-written TS module (Caesar/substitution/Vigenère/rotor) + verifier | Never trust LLM for char transforms |

**Cipher engine is TDD'd** (pure functions, easy red-green) — it's the one place a bug silently ruins playability.

---

## 9. Screens / flow

1. **Title** — PASS, a low solstice sun, "Begin the night." Subtle: the sun is already past noon.
2. **Brief (15s)** — "You are Unit. Tonight you are interrogated. Decode what they ask. Answer as one of us. The sun is setting." Skippable.
3. **Interrogation (core)** — clock/sky, interrogator line (enciphered → you decode), reply box, verdict beat. Loop ×N.
4. **Resolution** — pass (sunrise + reframe + dedication) or switch-off (retry).
5. **Hall of the Passed** — Algolia search of survivor transcripts; daily leaderboard (Neon).
6. **About / how it was made** — links the DEV post, credits, Turing dedication.

---

## 10. Accessibility (you care; judges notice)

- **Colorblind-safe ciphers:** never encode meaning in hue alone — letters + shape + position. Decode grid uses text, not color matching.
- **Keyboard-complete:** decode + reply + submit all keyboard-navigable.
- **Screen reader:** interrogator lines + verdicts in an aria-live region; cipher state announced.
- **Reduced motion:** shader → static stepped gradient; no shake.
- **Readable type:** dyslexia-friendly option; min 16px; high-contrast dusk palette tested.
- **No twitch, no timer-per-keystroke:** the clock advances per *turn*, not real seconds → cognitively accessible.

---

## 11. Wow-factor inventory

1. **The meta-joke:** a Turing Test where *you* are the machine trying to pass — and the judge is a real AI. Judges will feel it.
2. **Diegetic light bar:** the solstice sky shader IS your life. Beautiful + thematically exact.
3. **The hybrid reveal + dedication** — emotional payoff most jam games lack.
4. **Gemini as living opponent** with persistent persona + "tells."
5. **Hall of the Passed** — reading how strangers imitated humanity is quietly haunting + replayable.
6. **Daily solstice seed** — shareable result without being a Wordle clone.
7. **Plays instantly, offline-capable** — judge never hits a broken API.

---

## 12. Scope: MVP → stretch (hard cut lines)

**MVP (must ship — the whole game stands on this):**
- Cipher engine (Caesar + substitution) + verifier, TDD'd.
- Gemini Call A (question gen) + Call B (reply judge) via route handler, with offline fallback bank.
- Core turn loop, suspicion + clock, win/lose.
- Solstice sky (even if CSS-gradient stepped first, shader later).
- Hybrid ending + dedication.
- Deploy to Vercel. Plays start-to-finish.

**Stretch (in priority order):**
- WebGL shader sky (upgrade from CSS gradient).
- Vigenère + rotor ciphers (difficulty ramp).
- Neon daily seed + leaderboard.
- Algolia Hall of the Passed.
- Audio drone + verdict notes.
- Cloud Run for the Gemini call (Google-infra flex).

**Cut line rule:** if Day 10 and behind → ship MVP + shader + audio, drop Algolia/daily to "v2" mentioned in the post. A tight small game beats a broken big one (research-backed).

---

## 13. Two-week build plan (deadline June 21)

| Days | Focus | Output |
|---|---|---|
| 1–2 | Repo, Next.js scaffold, Tailwind, cipher engine TDD, route-handler skeleton | Decode a Caesar message in-browser |
| 3–4 | Gemini Call A + B, schemas, offline fallback bank, verifier wiring | One full real turn vs Gemini |
| 5–6 | Core loop: N turns, suspicion meter, clock, win/lose states | Playable run start→finish |
| 7 | Solstice palette (CSS-stepped) + Motion beats + typewriter | Feels like a game |
| 8 | Hybrid ending + dedication + resolution screens | Emotional arc complete |
| 9 | **Playtest + balance** (suspicion math, turn count, difficulty ramp) | Tuned, not frustrating |
| 10 | WebGL shader sky + audio | Wow layer |
| 11 | Neon: runs + daily seed + leaderboard | Daily mode live |
| 12 | Algolia: Hall of the Passed | Second loop live |
| 13 | **Write the DEV post** (40% of score) + record video demo w/ voiceover | Submission draft |
| 14 | Polish, a11y pass, deploy verify, buffer, submit | Shipped |

Playtest (Day 9) is non-negotiable — the suspicion/clock balance is the make-or-break feel.

---

## 14. The DEV write-up (≈40% of score — plan it like a feature)

Research: the post is read in full by judges; post reactions break ties. Structure:
1. **Hook (first 3 lines):** lead with the *fresh* angle, not the saturated loop — *"An Alan Turing tribute: crack ciphers and survive an interrogation before the solstice sun sets — judged live by Gemini."* + 15s GIF of the core loop. (Save "and you're the machine" as the second-line reveal, not the headline.)
2. **The idea & the three themes** — solstice/Turing/Pride, why the fusion.
3. **One deep technical detail** — the `responseSchema` interrogator + the "never trust the LLM for ciphers, verify locally" lesson. Devs love a real gotcha.
4. **The hybrid ending** — why allegory-then-reveal (tasteful tribute).
5. **Architecture diagram** (Napkin.ai API — you have the key) + GitHub embed.
6. **Play it now** link (live, offline-capable) + daily seed shout.
7. **Categories pursued** — flag Turing + Google AI explicitly.
8. **Credits + Turing dedication.**
Video: 60–90s, voiceover, show a decode → a reply that *fails* (suspicion up) → a reply that *passes* → the dusk → the dedication. Sell the meta-joke in the first 10s.

---

## 15. Risks & open questions

**Risks (mitigated):**
- *Core loop saturation (post-2023 reverse-Turing fatigue)* → don't lead with it; pitch tribute + cipher + countdown; the cipher layer + Turing biography are the genre-distinguishing differentiators (§1 positioning).
- *Reply-judge feels arbitrary/unfair (was the biggest risk)* → **structurally removed**: AI-judge no longer the lose condition, only score + depth; lose state is objective daylight (§3 Win/lose). Plus §4.4 fairness mitigations for the *score* feeling legible.
- *Decode tedium / cipher fatigue* → auto-propagate, drag-dial, tuned cadence (partial decodes mid-game), 6–10 word messages (§3).
- *Tone misfire on Turing/Pride* → survival-under-threat framing (not deception-as-essence), allegory + reveal-by-dedication, "inspired by," no depicted trauma, Hodges cite + GLAAD link, transparent devlog (§6.1).
- *LLM cipher unreliability* → local encipher + verify (§4.3).
- *API quota dies on submission day* → offline fallback bank, judge plays regardless (§4.3).
- *Reply-judge feels arbitrary/unfair* → show the "tell" every turn so verdicts feel legible; tune thresholds Day 9; clamp `suspicion_delta`.
- *Tone misfire on Turing/Pride* → hybrid allegory, reveal-by-dedication, no depicted trauma, sensitivity self-review before submit.
- *Scope creep* → hard MVP cut line (§12).

**Open questions (resolve during build):**
- Final title: PASS vs *The Longest Night*? (Lean PASS.)
- Turn count for the sweet-spot run length — tune in playtest (start 8).
- Does the player *choose* a decode key or get assisted hints? (Start: full manual decode w/ optional 1 hint/run via Gemini — another essential-AI touch.)
- Daily seed shared globally vs per-player streak? (Lean global daily, more viral.)
- Cloud Run worth the time vs Vercel-only? (Only if Days 1–12 land early.)

---

## 16. Definition of done

- [ ] Plays start→finish in-browser, no install, Gemini-off safe.
- [ ] All three prize categories provably essential (removable-test).
- [ ] Cipher engine green tests; verifier prevents unsolvable puzzles.
- [ ] A11y pass (keyboard, SR, reduced-motion, colorblind-safe).
- [ ] Hybrid ending + dedication land cleanly.
- [ ] Neon daily + leaderboard + Algolia Hall live (or gracefully cut, noted in post).
- [ ] DEV post + 60–90s voiceover video + GitHub embed.
- [ ] Deployed, live link verified, categories flagged, submitted before June 21 23:59 PDT.

---

## 17. Research basis (2026-06-03 red-team)

Four parallel research sweeps hardened this design. Key sources:

**Jam-winner patterns:** tiny+polished+web-based, theme-as-mechanic, post ≈40% of score, AI-as-opponent not asset-gen, breadth>flash. ([DEV Web Game Challenge winners](https://dev.to/devteam/congrats-to-the-winners-of-our-first-web-game-challenge-32co), [end3r judging notes](https://dev.to/end3r/judging-the-first-dev-web-game-challenge-17pc), [Gamedev.js Jam 2026](https://gamedevjs.com/competitions/gamedev-js-jam-2026-winners-announced/))

**Gemini feasibility:** 2.5-Flash + `responseSchema` = 98.5% schema compliance; turn-based only; offline fallback essential. ([Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [latency benchmarks](https://artificialanalysis.ai/models/gemini-2-5-flash/providers), [Gemini competition winners](https://ai.google.dev/competition))

**LLM-as-judge fairness:** temp 0–0.1, rubric, few-shot anchors (+25–30% consistency), show validated tell, verbosity/phrasing bias. ([Patronus](https://www.patronus.ai/llm-testing/llm-as-a-judge), [GoDaddy calibration](https://www.godaddy.com/resources/news/calibrating-scores-of-llm-as-a-judge), [GAMEBoT arXiv](https://arxiv.org/pdf/2412.13602), [unfaithful CoT arXiv](https://arxiv.org/pdf/2601.14691))

**Cipher UX:** auto-propagate, tap-to-fill, drag-dial, tuned cadence, near-miss signal. ([Golden Idol design](https://www.gamedeveloper.com/design/case-of-the-golden-idol), [Puzzle Baron Cryptograms](https://cryptograms.puzzlebaron.com/), [escape-room ciphers](https://lockpaperscissors.co/ciphers-playbook))

**Saturation:** reverse-Turing loop tired post-2023 — differentiate on cipher+biography+stakes, don't lead with the loop. ([AImong Us](https://gianluca.ai/aimong-us-game/), [Larp As AI / HN](https://news.ycombinator.com/item?id=43909191), [Human or Not](https://humanornot.so/), [PNAS Turing-test-passed 2025](https://www.pnas.org/doi/10.1073/pnas.2524472123))

**Tone:** passing = survival-under-threat (not deception-as-essence); system is antagonist; no depicted trauma; "inspired by"; cite Hodges; link GLAAD. ([Slate "drag show"](https://slate.com/life/2024/06/alan-turing-test-ru-paul-drag-race-queer-history-ai-openai-chatgpt.html), [Imitation Game critique](https://irreviews.com/2015/02/10/the-imitation-game-its-an-abomination/), [Tell Me Why / GLAAD](https://glaad.org/our-work/gaming/), [Hodges biography](https://www.amazon.com/Alan-Turing-Enigma-Inspired-Imitation/dp/069116472X))
