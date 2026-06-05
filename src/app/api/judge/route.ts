import { judgeReply, geminiEnabled } from '@/lib/gemini';
import { scoreReply } from '@/lib/score';

export const runtime = 'nodejs';

/**
 * POST { question, reply, recentTranscript? } -> { humanScore, tell, line, source }
 * Gemini is the interrogator; on ANY failure we fall back to the offline scorer
 * so the reply mechanic always works (key dead, quota out, demo build).
 */
export async function POST(req: Request) {
  let body: { question?: string; reply?: string; recentTranscript?: string; persona?: 'patient' | 'hard' } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body -> treated as a skip */
  }
  const reply = (body.reply ?? '').slice(0, 600); // sanitize length
  const question = (body.question ?? '').slice(0, 300);
  const recentTranscript = (body.recentTranscript ?? '').slice(0, 2000);
  const persona = body.persona === 'hard' || body.persona === 'patient' ? body.persona : undefined;

  let rateLimited = false;
  if (geminiEnabled()) {
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
