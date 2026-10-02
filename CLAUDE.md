# PASS: a solstice interrogation

Alan Turing tribute game built for the June Solstice Game Jam. It is the longest day of 1952
and you are a machine being questioned. Decode each enciphered question, answer well enough
to pass as human, and reach dawn before the solstice sun sets on you. Gemini writes the
questions, judges how human you sound, and presses you when you ring false.

Live: https://pass-game-six.vercel.app

## Stack

- Next.js 16.3.4 (App Router), React 19.2.8, TypeScript 7.0.2
- Tailwind CSS 4.3.3, `motion` for animation
- Remotion 4 for the trailer (separate composition, not part of the game runtime)
- Vitest 4 for tests
- pnpm (pinned `pnpm@10.34.5` in `packageManager`)

## Commands

- `pnpm dev` - run locally (http://localhost:3000)
- `pnpm build` / `pnpm start` - production build / serve
- `pnpm test` / `pnpm test:watch` - Vitest suite (cipher invariant, game state machine, puzzle, score)
- `pnpm typecheck` - `tsc --noEmit`
- `pnpm lint` - ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `pnpm trailer` - open the Remotion studio for the trailer
- `pnpm trailer:render` - render the trailer to `out/trailer.mp4`
- `pnpm prototype` / `pnpm sim` - standalone night-loop prototype + economy sim (throwaway node scripts)

## Layout

- `src/app/` - Next.js App Router; `api/{judge,press,question,casefile}` are the Gemini routes
- `src/components/` - `Game.tsx` (the whole client game), Scene/Rotor/TellMeter (room + cipher UI)
- `src/lib/game.ts` - pure, deterministic state machine (light economy, phases, win/lose), framework-free
- `src/lib/cipher.ts` - cipher engine; `encode`/`decode` with a verified round-trip invariant
- `src/lib/puzzle.ts` - builds and verifies each puzzle locally; offline question bank
- `src/lib/gemini.ts` - server-only Gemini calls (judge, press, question, case-file); falls back on any failure
- `src/lib/score.ts` - offline heuristic judge (the fallback for gemini.ts)
- `src/lib/lines.ts` - offline noir interrogator lines and case-file verdicts
- `src/lib/history.ts` - the real, cited Turing/Bletchley history shown in intercepts and the About panel
- `remotion/` - the trailer composition
- `prototype/` - throwaway node scripts used to tune the daylight economy (see `prototype/NOTES.md`)
- `docs/` - `SUBMISSION.md` (the DEV post) + screenshots

Path alias: `@/*` -> `src/*`.

Tests live beside their source in `src/lib/*.test.ts` (cipher, game, puzzle, score).

## Conventions and gotchas

- The game is one client component (`Game.tsx`) over a pure state machine (`game.ts`). Every
  Gemini route degrades to a local fallback, so the network is never load-bearing.
- **Death is objective, not AI-decided.** Daylight is a currency spent on decoding and
  answering; you die at zero. The AI only affects your score and the interrogation. Do not
  re-couple death to the AI.
- **Never trust an LLM with ciphertext.** Gemini supplies a plaintext and a cipher spec;
  `cipher.ts` builds and verifies the ciphertext locally and refuses to ship a puzzle unless
  `decode(encode(plain)) === plain`. Keep that gate.
- **The economy is tuned.** `game.ts` uses `start: 160, turns: 8`, already balanced past the
  `prototype/` sim. Do not re-balance close to a deadline.
- **No em dashes** anywhere in player-facing copy or the DEV post. The Gemini prompts also
  instruct against them, since the AI's spoken lines render on screen.

## Env vars

- `GEMINI_API_KEY` (optional) - the live interrogator: writes questions, judges replies,
  presses, files the case-file verdict. Without it, the offline fallback runs and the game is
  fully playable. `GOOGLE_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` are also accepted
  (checked in that order in `src/lib/gemini.ts`). Server-only, never reaches the browser.

## Deploy

Pushing to the connected branch auto-deploys on Vercel. No database, no other services. Cost
is usage-based Gemini calls only; Vercel hosting is on the free/hobby tier.

## Next.js version note

This Next.js version has breaking changes from older training data. Check
`node_modules/next/dist/docs/` for version-matched docs before relying on remembered APIs.
