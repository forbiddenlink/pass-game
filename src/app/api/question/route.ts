import { generateQuestion, geminiEnabled } from '@/lib/gemini';
import { pickQuestion } from '@/lib/puzzle';
import { forbiddenResponse, guardAiRequest } from '@/lib/guard';
import { int, readBody, theme as asTheme } from '@/lib/validate';

export const runtime = 'nodejs';

/**
 * POST { seed, turn, theme?, difficulty? } -> { plaintext, themeTag, source, rateLimited? }
 * Gemini authors the question when available; otherwise the offline bank (also
 * the answer when the guard refuses). Either way the CIPHER is built locally
 * (puzzle.ts) — never trusted from here. theme is allowlisted and difficulty
 * clamped to 1..5 because both are interpolated into the prompt.
 */
export async function POST(req: Request) {
  const gate = guardAiRequest(req);
  if (gate.status === 'forbidden') return forbiddenResponse();

  const body = await readBody(req);
  const seed = int(body.seed, 0, 2_147_483_647, 1);
  const turn = int(body.turn, 1, 8, 1);
  const theme = asTheme(body.theme);
  const difficulty = int(body.difficulty, 1, 5, 2);

  let rateLimited = gate.status === 'limited';
  if (!rateLimited && geminiEnabled() && theme) {
    try {
      const q = await generateQuestion({ theme, difficulty });
      return Response.json({ plaintext: q.plaintext, themeTag: q.themeTag, source: 'gemini' });
    } catch (e) {
      const msg = String(e);
      rateLimited = msg.includes('429') || /quota|rate.?limit/i.test(msg);
      console.error('[pass] question gemini failed, using offline:', msg.slice(0, 300));
    }
  }

  const q = pickQuestion(seed, turn);
  return Response.json({ plaintext: q.text, themeTag: q.theme, source: 'offline', rateLimited });
}
