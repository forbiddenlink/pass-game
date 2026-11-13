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
 * Two backends:
 *   - DURABLE (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN both set):
 *     per-IP limits via @upstash/ratelimit, global daily ceiling via INCR on
 *     `pass-game:ai:daily:<YYYY-MM-DD>:global`. FAILS CLOSED: any Redis error
 *     or a >2s timeout denies the request (reason 'store-error').
 *   - IN-MEMORY (env absent): per server instance only. On Vercel each warm
 *     lambda has its own counters, so the real ceiling is instances x the caps
 *     below. A cost backstop, not an exact quota. One production warning is
 *     logged when this fallback is in use.
 * Every Redis key is prefixed `pass-game:` (the database is shared).
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

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const LIMITS = {
  perIpPerMinute: 20,
  perIpPerDay: 400,
  globalPerDay: 4000,
  /** Cap on distinct IPs tracked, so a spoofed-header flood cannot grow memory. */
  maxTrackedIps: 10_000,
  /** Upstash call budget; past this the request is denied (fail closed). */
  storeTimeoutMs: 2000,
} as const;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type GuardResult =
  | { status: 'ok' }
  | { status: 'forbidden'; reason: 'cross-site' }
  | { status: 'limited'; reason: 'disabled' | 'ip-minute' | 'ip-day' | 'global-day' | 'tracker-full' | 'store-error'; retryAfterSec?: number };

interface Window {
  start: number;
  count: number;
}
const ipMinute = new Map<string, Window>();
const ipDay = new Map<string, Window>();
let globalDay: Window = { start: 0, count: 0 };

/** Test hook: clear all counters. */
export function resetGuard(): void {
  warned = false;
  cachedStore = null;
  ipMinute.clear();
  ipDay.clear();
  globalDay = { start: 0, count: 0 };
}

/** Kill switch. Any of 1/true/yes/on disables model calls; routes serve offline. */
export function aiDisabled(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|yes|on)$/i.test((env.PASS_AI_DISABLED ?? '').trim());
}

/**
 * Client IP. x-vercel-forwarded-for and x-real-ip are set by Vercel's edge and
 * cannot be spoofed by the caller. The left-most X-Forwarded-For hop is
 * client-controlled, so it is never used (it would let one caller mint
 * unlimited "IPs" and bypass the per-IP limits).
 */
export function clientIp(req: Request): string {
  const vercel = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  return vercel || req.headers.get('x-real-ip')?.trim() || 'unknown';
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

// ---- durable (Upstash) backend ------------------------------------------

type Reason = Extract<GuardResult, { status: 'limited' }>['reason'];

/** Minimal surface of a Ratelimit instance, so tests can inject fakes. */
export interface LimiterLike {
  limit(key: string): Promise<{ success: boolean; reset: number }>;
}
/** Minimal surface of the Redis client used for the global counter. */
export interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}
export interface DurableStore {
  minute: LimiterLike;
  day: LimiterLike;
  redis: RedisLike;
}

const PREFIX = 'pass-game:';

export function createUpstashStore(url: string, token: string): DurableStore {
  const redis = new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(LIMITS.storeTimeoutMs) });
  // No `timeout` option on Ratelimit: it fails OPEN on timeout. We enforce our own, fail-closed.
  const mk = (n: number, window: '1 m' | '1 d', name: string) =>
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(n, window), prefix: `${PREFIX}ai:rl:${name}`, analytics: false });
  return { minute: mk(LIMITS.perIpPerMinute, '1 m', 'minute'), day: mk(LIMITS.perIpPerDay, '1 d', 'day'), redis };
}

let cachedStore: { key: string; store: DurableStore } | null = null;
function storeFromEnv(env: Record<string, string | undefined>): DurableStore | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  const key = `${url}|${token}`;
  if (cachedStore?.key !== key) cachedStore = { key, store: createUpstashStore(url, token) };
  return cachedStore.store;
}

let warned = false;
function warnInMemory(env: Record<string, string | undefined>): void {
  if (warned || env.NODE_ENV !== 'production') return;
  warned = true;
  console.warn('[pass] guard: UPSTASH_REDIS_REST_URL/TOKEN not set; AI rate limits are per-instance (in-memory) and not durable');
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error('store timeout')), ms);
  });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

async function durableCheck(store: DurableStore, ip: string, now: number): Promise<GuardResult> {
  const m = await store.minute.limit(`${PREFIX}ip:${ip}`);
  if (!m.success) return { status: 'limited', reason: 'ip-minute', retryAfterSec: Math.max(1, Math.ceil((m.reset - now) / 1000)) };
  const d = await store.day.limit(`${PREFIX}ip:${ip}`);
  if (!d.success) return { status: 'limited', reason: 'ip-day', retryAfterSec: Math.max(1, Math.ceil((d.reset - now) / 1000)) };
  const key = `${PREFIX}ai:daily:${utcDay(now)}:global`;
  const n = await store.redis.incr(key);
  if (n === 1) await store.redis.expire(key, 2 * 24 * 60 * 60);
  if (n > LIMITS.globalPerDay) {
    const nextUtcMidnight = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
    return { status: 'limited', reason: 'global-day', retryAfterSec: Math.max(1, Math.ceil((nextUtcMidnight - now) / 1000)) };
  }
  return { status: 'ok' };
}

function memoryCheck(ip: string, now: number): GuardResult {
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

/**
 * `store` is a test seam: pass a DurableStore to force the durable path
 * without env vars. Production callers pass only `req`.
 */
export async function guardAiRequest(
  req: Request,
  now: number = Date.now(),
  env: Record<string, string | undefined> = process.env,
  store?: DurableStore,
): Promise<GuardResult> {
  if (isCrossSite(req)) return { status: 'forbidden', reason: 'cross-site' };
  if (aiDisabled(env)) return { status: 'limited', reason: 'disabled' };

  const ip = clientIp(req);
  let durable: DurableStore | null;
  try {
    durable = store ?? storeFromEnv(env);
  } catch (e) {
    console.error('[pass] guard: store init failed, denying:', String(e).slice(0, 200));
    return { status: 'limited', reason: 'store-error' };
  }
  if (!durable) {
    warnInMemory(env);
    return memoryCheck(ip, now);
  }
  try {
    return await withTimeout(durableCheck(durable, ip, now), LIMITS.storeTimeoutMs);
  } catch (e) {
    // FAIL CLOSED: a broken or slow store must never turn into unlimited spend.
    console.error('[pass] guard: store error, denying:', String(e).slice(0, 200));
    return { status: 'limited', reason: 'store-error', retryAfterSec: 30 };
  }
}

/** Standard 403 body for a cross-site POST. */
export const forbiddenResponse = () =>
  Response.json({ error: 'cross-site requests are not allowed' }, { status: 403 });
