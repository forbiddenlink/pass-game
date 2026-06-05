# PASS · a solstice interrogation

> Draft DEV post for the June Solstice Game Jam. Paste into DEV, then add: the cover image, the 60-90s demo video (voiceover optional, on-screen captions work fine), and the live screenshots marked [SCREENSHOT]. The GitHub embed and the dedication link are already filled in below. House rule: no em dashes anywhere in this post.

*Play it: https://pass-game-elizabeth-emersons-projects.vercel.app*

---

To convince the interrogator I was human, I typed a small childhood memory. It read my answer, leaned in, and pressed: "A precise recollection for such a tender age. And your father?" The interrogator is Gemini. It is trying to decide whether I am a machine. I am.

That is PASS: an Alan Turing tribute where you are the machine, cracking the interrogator's ciphers and answering well enough to pass as human, before the solstice sun finishes setting on you.

[COVER GIF: the interrogator reading your reply and pressing back, then the sun sinking through the barred window]

## What it is

It is the longest day of 1952. You are a machine, brought in to be questioned. Every question arrives enciphered. You decode it, then you may answer, in your own words, well enough to pass as one of them. The catch: daylight is your life, and it drains with everything you do. Reach dawn and you pass the night. Run out, and you go dark.

Three things sit underneath that, on purpose:

- **The solstice** is the clock. The sun crosses a barred window and sets as you spend daylight; a tick under the room quickens as the light fails.
- **Alan Turing** is the spine. The code-breaking is Bletchley. The "answer human enough to be believed" is his imitation game, turned on its head: you are the machine trying to pass. The ending is a quiet dedication.
- **A real AI** judges you. Google's Gemini reads each reply for how human it sounds, and presses you with a sharper follow-up when you ring false.

## The one decision the whole game is about

I started with a version where an AI decided whether you lived. That is a fairness trap: a game you can lose to a vibe feels broken, not hard. So the lose condition is now objective and legible. Daylight is a currency. Decoding spends it. A wrong guess spends more. Answering spends it too. Every turn you choose: bank your light and survive cheap but unbelieved, or spend it to be believed. The AI affects your score and the interrogation, never your death.

## One technical detail I am proud of

The interrogator is Gemini 2.5 Flash with structured output. Two calls per exchange: one judges the reply (a `responseSchema` returns `human_score`, a `tell`, and a spoken line, at temperature 0.1 so a retested answer scores the same), and one presses you with a follow-up that references your actual words when the answer is weak. That press is what turns a one-shot quiz into a conversation, which is what a Turing test actually is.

The cipher lesson is the one I would tell another dev. LLMs are unreliable at character-level transforms, so I never trust an AI-supplied ciphertext. Gemini (or the offline bank) supplies a plaintext and a cipher *spec*; the cipher engine builds and verifies the ciphertext locally, and refuses to ship a puzzle unless `decode(encode(plain)) === plain`. The whole engine is test-first. There is also a full offline fallback (a question bank plus a heuristic judge), so the game plays start to finish with no API key. That is deliberate: a judge can play the submitted build even if my quota is gone.

[SCREENSHOT: the cipher rotor mid-turn]
[SCREENSHOT: the interrogation transcript building]

## The Turing tribute, handled with care

You play an unnamed machine the whole way. Only at the end does the game name the man it is for. I kept it to an allegory and a dedication, with no depiction of his prosecution or his death. The line is "inspired by the work of Alan Turing," not a claim to tell his story. The original 1950 imitation game was itself a test of passing, which is why the metaphor fits without being forced.

## How it is built

Next.js 16, React 19, TypeScript, Tailwind. The interrogation room is CSS and SVG: a barred window with the setting sun, a swaying desk lamp, a silhouette across the table, a vignette that closes in as the light dies. Motion for the reveals, a small WebAudio synth for the drone, the ticks, and the switch-off. Gemini through a server route so the key never reaches the browser. Deployed on Vercel.

## Prize categories

- **Best Ode to Alan Turing**: the imitation game as the core loop, cipher code-breaking, and a dedication earned by the whole premise.
- **Best Google AI Usage**: Gemini does four jobs in this game, not one. It writes each night's questions (so no two nights interrogate you the same way), it judges how human your reply reads with structured output, it presses you with a sharper follow-up that remembers what you said three answers ago, and at dawn it files a case-file verdict on your whole performance. Remove it and there is no opponent, no questions, and no verdict.

## Play it and credits

Live: https://pass-game-elizabeth-emersons-projects.vercel.app
Code: {% embed https://github.com/forbiddenlink/pass-game %}

For Alan Turing, 1912 to 1954. With thanks to the people who keep his memory honest, and to [Stonewall](https://www.stonewall.org.uk), who carry the work forward.

Made for the June Solstice Game Jam. It is a jam entry and a sincere tribute at the same time, and I would rather say that plainly than pretend otherwise.
