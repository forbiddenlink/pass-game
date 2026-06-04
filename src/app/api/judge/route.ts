import { judgeReply, geminiEnabled } from '@/lib/gemini';
import { scoreReply } from '@/lib/score';

export const runtime = 'nodejs';

/**
 * POST { question, reply, recentTranscript? } -> { humanScore, tell, line, source }
 * Gemini is the interrogator; on ANY failure we fall back to the offline scorer
 * so the reply mechanic always works (key dead, quota out, demo build).
 */
export async function POST(req: Request) {
  let body: { question?: string; reply?: string; recentTranscript?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body -> treated as a skip */
  }
  const reply = (body.reply ?? '').slice(0, 600); // sanitize length
  const question = (body.question ?? '').slice(0, 300);

  if (geminiEnabled()) {
    try {
      const v = await judgeReply({ question, reply, recentTranscript: body.recentTranscript });
      return Response.json({ humanScore: v.human_score, tell: v.tell, line: v.line, source: 'gemini' });
    } catch {
      /* fall through to offline */
    }
  }

  const h = scoreReply(reply);
  return Response.json({ humanScore: h.score, tell: h.tell, line: '', source: 'offline' });
}
