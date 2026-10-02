import { pressFollowup, geminiEnabled } from '@/lib/gemini';
import { pressLine } from '@/lib/lines';
import { forbiddenResponse, guardAiRequest } from '@/lib/guard';
import { persona as asPersona, readBody, text } from '@/lib/validate';

export const runtime = 'nodejs';

/**
 * POST { question, reply } -> { followup, source, rateLimited? }
 * The interrogator's adaptive press when a reply rings false. Gemini references
 * the actual answer; offline (or a guard refusal) falls back to a canned press.
 * Never 500s.
 */
export async function POST(req: Request) {
  const gate = guardAiRequest(req);
  if (gate.status === 'forbidden') return forbiddenResponse();

  const body = await readBody(req);
  const question = text(body.question, 300);
  const reply = text(body.reply, 600);
  const recentTranscript = text(body.recentTranscript, 2000);
  const persona = asPersona(body.persona);

  let rateLimited = gate.status === 'limited';
  if (!rateLimited && geminiEnabled()) {
    try {
      const followup = await pressFollowup({ question, reply, recentTranscript, persona });
      return Response.json({ followup, source: 'gemini' });
    } catch (e) {
      const msg = String(e);
      rateLimited = msg.includes('429') || /quota|rate.?limit/i.test(msg);
      console.error('[pass] press gemini failed, using offline:', msg.slice(0, 300));
    }
  }
  return Response.json({ followup: pressLine(reply.length), source: 'offline', rateLimited });
}
