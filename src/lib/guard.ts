/**
 * Server guard for the four Gemini routes — SERVER ONLY.
 *
 * Every route that can spend money calls `guardAiRequest(req)` first. It
 * answers three questions, in this order:
 *   1. Is this a cross-site browser POST?  -> 'forbidden' (route returns 403)
 *   2. Is the AI switched off (PASS_AI_DISABLED=1) or over a limit?
 *                                          -> 'limited' (route serves its OFFLINE fallback)
 *   3. Otherwise                           -> 'ok' (route may call Gemini)
 *
 * Limits are IN-MEMORY and PER SERVER INSTANCE. On Vercel each warm lambda has
 * its own counters, so the real fleet-wide ceiling is (instances x the caps
 * below). They are a cost backstop and a speed bump, not an exact quota. For
 * exact fleet-wide limits use a shared store (Upstash) and a Google AI Studio
 * quota cap; neither is wired here.
 *
 * Sizing (one full night = 8 turns, see DEFAULT_ECON.turns in game.ts):
 *   per night: <= 7 question prefetches + <= 16 judge (a reply, then a reply to
 *   the press) + <= 8 press + 1 casefile = <= 32 calls, typically ~20.
 *   - per IP per minute: 20   (a fast player makes ~4/min; this tolerates bursts
 *                              and several people behind one NAT)
 *   - per IP per 24h:    400  (~12 worst-case full nights, ~20 typical)
 *   - global per instance per 24h: 4000 (~125 worst-case nights; at roughly
 *                              1k tokens per Flash call that is a few dollars)
 */

export const LIMITS = {
  perIpPerMinute: 20,
  perIpPerDay: 400,
  globalPerDay: 4000,
  /** Cap on distinct IPs tracked, so a spoofed-header flood cannot grow memory. */
  maxTrackedIps: 10_000,
} as const;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type GuardResult =
  | { status: 'ok' }
  | { status: 'forbidden'; reason: 'cross-site' }
  | { status: 'limited'; reason: 'disabled' | 'ip-minute' | 'ip-day' | 'global-day' | 'tracker-full' };

interface Window {
  start: number;
  count: number;
}
const ipMinute = new Map<string, Window>();
const ipDay = new Map<string, Window>();
let globalDay: Window = { start: 0, count: 0 };

/** Test hook: clear all counters. */
export function resetGuard(): void {
  ipMinute.clear();
  ipDay.clear();
  globalDay = { start: 0, count: 0 };
}

/** Kill switch. Any of 1/true/yes/on disables model calls; routes serve offline. */
export function aiDisabled(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|yes|on)$/i.test((env.PASS_AI_DISABLED ?? '').trim());
}

/** Client IP: first hop of x-forwarded-for, then x-real-ip. Vercel sets both. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Reject browser POSTs that originate from another site.
 *  - Sec-Fetch-Site present: only same-origin (or none) passes.
 *  - Else Origin present: its host must equal the request host.
 *  - Neither header (curl, server-side tests): allowed. Non-browser callers can
 *    forge headers anyway; the rate limits are what stop them, not this check.
 */
export function isCrossSite(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site !== 'same-origin' && site !== 'none';
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true; // malformed Origin (including the literal "null")
  }
}

function hit(map: Map<string, Window>, key: string, limit: number, span: number, now: number): boolean {
  const w = map.get(key);
  if (!w || now - w.start >= span) {
    map.set(key, { start: now, count: 1 });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}

function prune(now: number): void {
  for (const [k, w] of ipMinute) if (now - w.start >= MINUTE) ipMinute.delete(k);
  for (const [k, w] of ipDay) if (now - w.start >= DAY) ipDay.delete(k);
}

export function guardAiRequest(
  req: Request,
  now: number = Date.now(),
  env: Record<string, string | undefined> = process.env,
): GuardResult {
  if (isCrossSite(req)) return { status: 'forbidden', reason: 'cross-site' };
  if (aiDisabled(env)) return { status: 'limited', reason: 'disabled' };

  const ip = clientIp(req);
  if (ipDay.size >= LIMITS.maxTrackedIps && !ipDay.has(ip)) {
    prune(now);
    if (ipDay.size >= LIMITS.maxTrackedIps) return { status: 'limited', reason: 'tracker-full' };
  }

  // Check without consuming first, so a request refused by one limit does not
  // burn the others. Order: cheapest-to-explain first.
  const m = ipMinute.get(ip);
  if (m && now - m.start < MINUTE && m.count >= LIMITS.perIpPerMinute) return { status: 'limited', reason: 'ip-minute' };
  const d = ipDay.get(ip);
  if (d && now - d.start < DAY && d.count >= LIMITS.perIpPerDay) return { status: 'limited', reason: 'ip-day' };
  if (now - globalDay.start < DAY && globalDay.count >= LIMITS.globalPerDay) return { status: 'limited', reason: 'global-day' };

  hit(ipMinute, ip, LIMITS.perIpPerMinute, MINUTE, now);
  hit(ipDay, ip, LIMITS.perIpPerDay, DAY, now);
  if (now - globalDay.start >= DAY) globalDay = { start: now, count: 0 };
  globalDay.count += 1;
  return { status: 'ok' };
}

/** Standard 403 body for a cross-site POST. */
export const forbiddenResponse = () =>
  Response.json({ error: 'cross-site requests are not allowed' }, { status: 403 });
