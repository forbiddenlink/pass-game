import { generateQuestion, geminiEnabled } from '@/lib/gemini';
import { pickQuestion, type ThemeTag } from '@/lib/puzzle';

export const runtime = 'nodejs';

/**
 * POST { seed, turn, theme?, difficulty? } -> { plaintext, themeTag, source }
 * Gemini authors the question when available; otherwise the offline bank.
 * Either way the CIPHER is built locally (puzzle.ts) — never trusted from here.
 */
export async function POST(req: Request) {
  let body: { seed?: number; turn?: number; theme?: ThemeTag; difficulty?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* fall back to deterministic bank pick below */
  }
  const seed = body.seed ?? 1;
  const turn = body.turn ?? 1;

  if (geminiEnabled() && body.theme) {
    try {
      const q = await generateQuestion({ theme: body.theme, difficulty: body.difficulty ?? 2 });
      return Response.json({ plaintext: q.plaintext, themeTag: q.themeTag, source: 'gemini' });
    } catch (e) {
      console.error('[pass] question gemini failed, using offline:', String(e).slice(0, 300));
    }
  }

  const q = pickQuestion(seed, turn);
  return Response.json({ plaintext: q.text, themeTag: q.theme, source: 'offline' });
}
