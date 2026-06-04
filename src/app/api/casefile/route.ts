import { caseFile, geminiEnabled } from '@/lib/gemini';
import { offlineCaseFile } from '@/lib/lines';

export const runtime = 'nodejs';

/**
 * POST { transcript, outcome, believed } -> { classification, note, recommendation, source }
 * A noir case-file verdict on the whole night. Gemini writes it from the
 * transcript; offline falls back to a templated verdict. Never 500s.
 */
export async function POST(req: Request) {
  let body: { transcript?: string; outcome?: string; believed?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* offline fallback */
  }
  const outcome = (body.outcome ?? 'OFF').slice(0, 8);
  const believed = typeof body.believed === 'number' ? body.believed : 0;

  if (geminiEnabled()) {
    try {
      const cf = await caseFile({
        transcript: (body.transcript ?? '').slice(0, 4000),
        outcome,
        believed: believed.toFixed(2),
      });
      return Response.json({ ...cf, source: 'gemini' });
    } catch {
      /* fall through */
    }
  }
  return Response.json({ ...offlineCaseFile(outcome, believed), source: 'offline' });
}
