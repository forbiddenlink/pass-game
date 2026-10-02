import { caseFile, geminiEnabled } from '@/lib/gemini';
import { offlineCaseFile } from '@/lib/lines';
import { forbiddenResponse, guardAiRequest } from '@/lib/guard';
import { ending, num, readBody, text } from '@/lib/validate';

export const runtime = 'nodejs';

/**
 * POST { transcript, outcome, believed } -> { classification, note, recommendation, source, rateLimited? }
 * A noir case-file verdict on the whole night. Gemini writes it from the
 * transcript; offline (or a guard refusal) falls back to a templated verdict.
 * Never 500s.
 */
export async function POST(req: Request) {
  const gate = guardAiRequest(req);
  if (gate.status === 'forbidden') return forbiddenResponse();

  const body = await readBody(req);
  const outcome = ending(body.outcome);
  const believed = num(body.believed, 0, 1, 0);
  const rateLimited = gate.status === 'limited';

  if (!rateLimited && geminiEnabled()) {
    try {
      const cf = await caseFile({
        transcript: text(body.transcript, 4000),
        outcome,
        believed: believed.toFixed(2),
      });
      return Response.json({ ...cf, source: 'gemini' });
    } catch (e) {
      console.error('[pass] casefile gemini failed, using offline:', String(e).slice(0, 300));
    }
  }
  return Response.json({ ...offlineCaseFile(outcome, believed), source: 'offline', rateLimited });
}
