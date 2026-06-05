import { pressFollowup, geminiEnabled } from '@/lib/gemini';
import { pressLine } from '@/lib/lines';

export const runtime = 'nodejs';

/**
 * POST { question, reply } -> { followup, source }
 * The interrogator's adaptive press when a reply rings false. Gemini references
 * the actual answer; offline falls back to a canned press. Never 500s.
 */
export async function POST(req: Request) {
  let body: { question?: string; reply?: string; recentTranscript?: string; persona?: 'patient' | 'hard' } = {};
  try {
    body = await req.json();
  } catch {
    /* offline fallback below */
  }
  const question = (body.question ?? '').slice(0, 300);
  const reply = (body.reply ?? '').slice(0, 600);
  const recentTranscript = (body.recentTranscript ?? '').slice(0, 2000);
  const persona = body.persona === 'hard' || body.persona === 'patient' ? body.persona : undefined;

  let rateLimited = false;
  if (geminiEnabled()) {
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
