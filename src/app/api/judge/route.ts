import { judgeReply, geminiEnabled } from '@/lib/gemini';
import { scoreReply } from '@/lib/score';
import { forbiddenResponse, guardAiRequest } from '@/lib/guard';
import { persona as asPersona, readBody, text } from '@/lib/validate';

export const runtime = 'nodejs';

/**
 * POST { question, reply, recentTranscript? } -> { humanScore, tell, line, source, rateLimited? }
 * Gemini is the interrogator; on ANY failure, or when the guard refuses (rate
 * limit, kill switch), we fall back to the offline scorer so the reply mechanic
 * always works. A guard refusal sets rateLimited so the client stops prefetching.
 */
export async function POST(req: Request) {
  const gate = guardAiRequest(req);
  if (gate.status === 'forbidden') return forbiddenResponse();

  const body = await readBody(req);
  const reply = text(body.reply, 600);
  const question = text(body.question, 300);
  const recentTranscript = text(body.recentTranscript, 2000);
  const persona = asPersona(body.persona);

  let rateLimited = gate.status === 'limited';
  if (!rateLimited && geminiEnabled()) {
    try {
      const v = await judgeReply({ question, reply, recentTranscript, persona });
      return Response.json({ humanScore: v.human_score, tell: v.tell, line: v.line, contradiction: v.contradiction, source: 'gemini' });
    } catch (e) {
      // Don't swallow silently: a 429 (quota) or bad key looks identical to a
      // working offline demo otherwise. Logged server-side; player still gets a verdict.
      const msg = String(e);
      rateLimited = msg.includes('429') || /quota|rate.?limit/i.test(msg);
      console.error('[pass] judge gemini failed, using offline:', msg.slice(0, 300));
    }
  }

  const h = scoreReply(reply);
  return Response.json({ humanScore: h.score, tell: h.tell, line: '', source: 'offline', rateLimited });
}
