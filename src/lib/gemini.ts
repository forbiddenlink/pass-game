/**
 * Gemini interrogator — SERVER ONLY. Never import from a client component.
 *
 * The API key is read from the environment here and never leaves the server
 * (the route handler returns only scores + flavor text). Every call is wrapped
 * so a missing key / quota / network error throws cleanly and the caller falls
 * back to the offline scorer (score.ts) — the game must never hard-depend on
 * the network. Structured output (responseSchema) per design §4.1/§4.4.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { normalize } from './cipher';
import type { ThemeTag } from './puzzle';

const THEME_TAGS: ThemeTag[] = ['light', 'time', 'memory', 'fear', 'identity'];
const asTheme = (t: string): ThemeTag =>
  (THEME_TAGS as string[]).includes(t) ? (t as ThemeTag) : 'identity';

const MODEL = 'gemini-2.5-flash';

export function geminiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    null
  );
}
export const geminiEnabled = () => geminiKey() !== null;

function client(): GoogleGenAI {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error('gemini: no API key configured');
  return new GoogleGenAI({ apiKey });
}

export interface GeminiVerdict {
  human_score: number; // 0..1
  tell: string;
  line: string; // the interrogator's spoken reaction, in character
}

const JUDGE_SYSTEM = `You are an interrogator in 1952, clipped, courteous, and quietly menacing.
Your hidden task: decide whether the subject answering you is a machine imitating a human.
Score how HUMAN the reply reads — warmth, hesitation, contradiction, specificity, plausible
imperfection. A flawless, over-composed, or evasive answer is LESS human. Do NOT reward length;
terse human answers are fine. Derive "tell" from the same judgement as the score (never contradict
it). Stay in character in "line".`;

/** Judge a player's reply. Throws on any failure (caller falls back to offline). */
export async function judgeReply(input: {
  question: string;
  reply: string;
  recentTranscript?: string;
}): Promise<GeminiVerdict> {
  const ai = client();
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Question you asked: "${input.question}"
Subject's reply: "${input.reply}"
${input.recentTranscript ? `Recent exchange:\n${input.recentTranscript}` : ''}
Judge how human the reply reads.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: JUDGE_SYSTEM,
      temperature: 0.1, // near-deterministic so a retested reply scores the same
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          human_score: { type: Type.NUMBER },
          tell: { type: Type.STRING },
          line: { type: Type.STRING },
        },
        required: ['human_score', 'tell', 'line'],
      },
    },
  });

  const parsed = JSON.parse(res.text ?? '{}') as GeminiVerdict;
  if (typeof parsed.human_score !== 'number') throw new Error('gemini: bad verdict shape');
  parsed.human_score = Math.max(0, Math.min(1, parsed.human_score));
  return parsed;
}

export interface GeminiQuestion {
  plaintext: string;
  themeTag: ThemeTag;
}

const QUESTION_SYSTEM = `You are a 1952 interrogator probing whether the subject is a machine.
Produce ONE short question (6-10 words, lowercase, no punctuation, plain ascii letters and spaces
only) that probes the given theme. It should be answerable by a person and revealing if answered by
a machine. Escalate intimacy with difficulty.`;

/** Optional: a Gemini-authored question. Throws on failure (caller uses the offline bank). */
export async function generateQuestion(input: {
  theme: ThemeTag;
  difficulty: number;
}): Promise<GeminiQuestion> {
  const ai = client();
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: `Theme: ${input.theme}. Difficulty: ${input.difficulty}/5.` }],
      },
    ],
    config: {
      systemInstruction: QUESTION_SYSTEM,
      temperature: 0.9, // questions want variety
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plaintext: { type: Type.STRING },
          themeTag: { type: Type.STRING },
        },
        required: ['plaintext', 'themeTag'],
      },
    },
  });
  const parsed = JSON.parse(res.text ?? '{}') as GeminiQuestion;
  if (!parsed.plaintext) throw new Error('gemini: empty question');
  return { plaintext: normalize(parsed.plaintext), themeTag: asTheme(parsed.themeTag) };
}
