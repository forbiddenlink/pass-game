---
title: "PASS: a solstice interrogation"
published: false
cover_image: https://REPLACE_WITH_UPLOADED_URL/cover-og.png
tags: devchallenge, gamechallenge, gamedev
---

<!--
  PASTE-INTO-DEV CHECKLIST (delete this comment before publishing):
  1. Upload docs/screenshots/cover-og.png, copy its URL into `cover_image` above.
  2. In "Video Demo", upload out/trailer.mp4 (drag into the DEV editor) or paste a YouTube/Vimeo link.
  3. In "How I Built It", upload docs/screenshots/cipher-rotor.png and interrogation.png where marked.
  4. Confirm tags are exactly: devchallenge, gamechallenge, gamedev. House rule: no em dashes anywhere.
-->

To convince the interrogator I was human, I typed a small childhood memory. It read my answer, leaned in, and pressed: *"A precise recollection for such a tender age. And your father?"* The interrogator is Gemini. It is trying to decide whether I am a machine. **I am.**

### ▶ Play it: https://pass-game-elizabeth-emersons-projects.vercel.app

## What I Built

**PASS** is an Alan Turing tribute where you are the machine, trying to pass as human before the solstice sun sets on you.

It is the longest day of 1952. You have been brought in to be questioned. Every question arrives enciphered, so first you **decode** it. Then you may **answer**, in your own words, well enough to be believed. The catch: **daylight is your life**, and it drains with everything you do. Reach dawn and you pass the night. Run out, and you go dark.

Three things sit underneath that, on purpose:

- **The solstice is the clock.** The sun crosses a barred window and sets as you spend daylight. A tick under the room quickens as the light fails. It is your health bar, and it only moves one way.
- **Alan Turing is the spine.** The code-breaking is Bletchley. The "answer human enough to be believed" is his imitation game, turned on its head: you are the machine trying to pass. The ending is a quiet dedication.
- **A real AI judges you.** Google's Gemini writes the questions, reads each reply for how human it sounds, and presses you with a sharper follow-up when you ring false.

**The one design decision the whole game turns on:** I started with a version where the AI decided whether you lived. That is a fairness trap. A game you can lose to a vibe feels broken, not hard. So death is now objective and legible: daylight is a currency, decoding spends it, a wrong guess spends more, answering spends it too. Every turn you choose to bank your light and survive cheap but unbelieved, or spend it to be believed. The AI shapes your score and the interrogation, never your death.

## Video Demo

<!-- Upload out/trailer.mp4 here (drag it into the DEV editor), or paste a YouTube/Vimeo link. 50s, on-screen captions. -->

{% embed REPLACE_WITH_VIDEO_URL %}

## Code

{% embed https://github.com/forbiddenlink/pass-game %}

## How I Built It

Next.js 16, React 19, TypeScript, Tailwind. The interrogation room is pure CSS and SVG: a barred window with the setting sun, a swaying desk lamp, a silhouette across the table, a vignette that closes in as the light dies. Motion for the reveals, a tiny WebAudio synth for the drone, the ticks, and the switch-off. Gemini runs through a server route, so the key never reaches the browser. Deployed on Vercel.

![The caesar rotor mid-decode](REPLACE_WITH_UPLOADED_URL/cipher-rotor.png)

**The Gemini integration is the heart of it.** It is Gemini 2.5 Flash with structured output, doing four distinct jobs:

1. **It writes each night's questions**, so no two nights interrogate you the same way.
2. **It judges how human your reply reads**, returning a `responseSchema` with `human_score`, a `tell`, and a spoken line, at temperature 0.1 so a retested answer scores the same.
3. **It presses you** with a sharper follow-up that remembers what you said three answers ago. That press is what turns a one-shot quiz into a conversation, which is what a Turing test actually is.
4. **At dawn it files a case-file verdict** on your whole performance, in the voice of a 1952 analyst.

![Gemini reading the reply and filing its verdict](REPLACE_WITH_UPLOADED_URL/interrogation.png)

**The lesson I would pass to another dev:** LLMs are unreliable at character-level transforms, so I never trust an AI-supplied ciphertext. Gemini (or the offline bank) supplies a plaintext and a cipher *spec*. The cipher engine then builds and verifies the ciphertext locally and refuses to ship a puzzle unless `decode(encode(plain)) === plain`. The whole engine is test-first.

There is also a full offline fallback: a question bank plus a heuristic judge, so the game plays start to finish with no API key. That was deliberate. A judge can complete the submitted build even if my quota runs out mid-review.

**On the tribute, handled with care:** you play an unnamed machine the whole way, and only at the end does the game name the man it is for. There is no dramatization of his prosecution or his death. An optional history panel states those facts plainly, cites its sources, and leaves the cause of death unresolved, as the inquest did. The game stays an allegory and a dedication, not a claim to tell his story.

## Prize Category

**Best Ode to Alan Turing.** The imitation game is the core loop, not a theme pasted on top. You break ciphers like Bletchley, you answer to pass as human like his 1950 test, and the dedication is earned by the whole premise rather than announced.

**Best Google AI Usage.** Gemini does four jobs here, not one: it writes the questions, judges your humanity with structured output, presses you with memory of what you said earlier, and files a closing verdict. Remove it and there is no opponent, no questions, and no verdict. I also leaned on Google AI Studio to iterate the prompts and schemas.

---

For Alan Turing, 1912 to 1954. With thanks to the people who keep his memory honest, and to [Stonewall](https://www.stonewall.org.uk), who carry the work forward.

Made for the June Solstice Game Jam. It is a jam entry and a sincere tribute at the same time, and I would rather say that plainly than pretend otherwise.
