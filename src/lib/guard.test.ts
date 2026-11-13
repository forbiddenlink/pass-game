import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS, type DurableStore, aiDisabled, clientIp, guardAiRequest, isCrossSite, resetGuard } from './guard';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://pass-game-six.vercel.app/api/judge', { method: 'POST', headers });
const from = (ip: string, extra: Record<string, string> = {}) => req({ 'x-vercel-forwarded-for': ip, ...extra });
const NOW = 1_000_000_000_000;

beforeEach(() => resetGuard());

describe('clientIp', () => {
  it('prefers x-vercel-forwarded-for over x-real-ip', () => {
    expect(clientIp(req({ 'x-vercel-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' }))).toBe('1.2.3.4');
  });
  it('never uses the left-most x-forwarded-for hop (client-controlled)', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1' }))).toBe('unknown');
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6', 'x-vercel-forwarded-for': '1.2.3.4' }))).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip, then unknown', async () => {
    expect(clientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(req())).toBe('unknown');
  });
});

describe('isCrossSite', () => {
  it('allows same-origin and header-less (non-browser) requests', async () => {
    expect(isCrossSite(req({ 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossSite(req({ 'sec-fetch-site': 'none' }))).toBe(false);
    expect(isCrossSite(req())).toBe(false);
    expect(isCrossSite(req({ origin: 'https://pass-game-six.vercel.app', host: 'pass-game-six.vercel.app' }))).toBe(false);
  });
  it('rejects cross-site and same-site fetches', async () => {
    expect(isCrossSite(req({ 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossSite(req({ 'sec-fetch-site': 'same-site' }))).toBe(true);
  });
  it('rejects a foreign or malformed Origin when Sec-Fetch-Site is absent', async () => {
    expect(isCrossSite(req({ origin: 'https://evil.example', host: 'pass-game-six.vercel.app' }))).toBe(true);
    expect(isCrossSite(req({ origin: 'null', host: 'pass-game-six.vercel.app' }))).toBe(true);
  });
  it('prefers x-forwarded-host when comparing Origin', async () => {
    expect(isCrossSite(req({ origin: 'https://pass-game-six.vercel.app', host: 'internal:3000', 'x-forwarded-host': 'pass-game-six.vercel.app' }))).toBe(false);
  });
});

describe('kill switch', () => {
  it('reads PASS_AI_DISABLED', async () => {
    expect(aiDisabled({ PASS_AI_DISABLED: '1' })).toBe(true);
    expect(aiDisabled({ PASS_AI_DISABLED: 'true' })).toBe(true);
    expect(aiDisabled({ PASS_AI_DISABLED: '0' })).toBe(false);
    expect(aiDisabled({})).toBe(false);
  });
  it('limits every request, whatever the IP', async () => {
    expect(await guardAiRequest(from('1.1.1.1'), NOW, { PASS_AI_DISABLED: '1' })).toEqual({ status: 'limited', reason: 'disabled' });
  });
  it('still rejects cross-site first', async () => {
    expect((await guardAiRequest(from('1.1.1.1', { 'sec-fetch-site': 'cross-site' }), NOW, { PASS_AI_DISABLED: '1' })).status).toBe('forbidden');
  });
});

describe('per-IP limits', () => {
  it('allows perIpPerMinute then limits that IP only', async () => {
    for (let i = 0; i < LIMITS.perIpPerMinute; i++) expect((await guardAiRequest(from('1.1.1.1'), NOW + i, {})).status).toBe('ok');
    expect(await guardAiRequest(from('1.1.1.1'), NOW + 100, {})).toEqual({ status: 'limited', reason: 'ip-minute' });
    expect((await guardAiRequest(from('2.2.2.2'), NOW + 100, {})).status).toBe('ok');
  });
  it('recovers after the minute window', async () => {
    for (let i = 0; i < LIMITS.perIpPerMinute; i++) await guardAiRequest(from('1.1.1.1'), NOW, {});
    expect((await guardAiRequest(from('1.1.1.1'), NOW + 60_001, {})).status).toBe('ok');
  });
  it('enforces the daily cap across minutes, and resets after 24h', async () => {
    let t = NOW;
    for (let i = 0; i < LIMITS.perIpPerDay; i++) {
      expect((await guardAiRequest(from('1.1.1.1'), t, {})).status).toBe('ok');
      t += 61_000; // a fresh minute window each time, so only the day cap bites
    }
    expect(await guardAiRequest(from('1.1.1.1'), t, {})).toEqual({ status: 'limited', reason: 'ip-day' });
    expect((await guardAiRequest(from('1.1.1.1'), NOW + 24 * 60 * 60_000 + 1, {})).status).toBe('ok');
  });
  it('lets a normal full night through (about 32 calls over several minutes)', async () => {
    let t = NOW;
    for (let i = 0; i < 32; i++) {
      expect((await guardAiRequest(from('9.9.9.9'), t, {})).status).toBe('ok');
      t += 15_000; // 4 calls a minute
    }
  });
});

describe('global per-instance cap', () => {
  it('limits all IPs once the daily total is spent', async () => {
    // distinct IPs so no per-IP limit fires first
    for (let i = 0; i < LIMITS.globalPerDay; i++) {
      expect((await guardAiRequest(from(`10.${i >> 16}.${(i >> 8) & 255}.${i & 255}`), NOW, {})).status).toBe('ok');
    }
    expect(await guardAiRequest(from('200.200.200.200'), NOW, {})).toEqual({ status: 'limited', reason: 'global-day' });
    // resets after 24h
    expect((await guardAiRequest(from('200.200.200.200'), NOW + 24 * 60 * 60_000 + 1, {})).status).toBe('ok');
  });
  it('does not consume the global budget for a request refused by a per-IP limit', async () => {
    for (let i = 0; i < LIMITS.perIpPerMinute; i++) await guardAiRequest(from('1.1.1.1'), NOW, {});
    for (let i = 0; i < 50; i++) await guardAiRequest(from('1.1.1.1'), NOW, {});
    // only perIpPerMinute requests were counted globally; the rest of the budget is intact
    let ok = 0;
    for (let i = 0; i < LIMITS.globalPerDay; i++) {
      if ((await guardAiRequest(from(`11.${i >> 16}.${(i >> 8) & 255}.${i & 255}`), NOW, {})).status === 'ok') ok++;
    }
    expect(ok).toBe(LIMITS.globalPerDay - LIMITS.perIpPerMinute);
  });
});

describe('in-memory fallback when Upstash env is absent', () => {
  it('works and logs one production warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = { NODE_ENV: 'production' };
    expect((await guardAiRequest(from('1.1.1.1'), NOW, env)).status).toBe('ok');
    expect((await guardAiRequest(from('1.1.1.1'), NOW, env)).status).toBe('ok');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it('stays in memory when only one of the two env vars is set', async () => {
    const env = { UPSTASH_REDIS_REST_URL: 'https://x.upstash.io' };
    expect((await guardAiRequest(from('1.1.1.1'), NOW, env)).status).toBe('ok');
  });
});

describe('durable (Upstash) backend', () => {
  const ok = { success: true, reset: NOW + 60_000 };
  const fakeStore = (over: Partial<DurableStore> = {}): DurableStore & { counts: Map<string, number>; expires: string[] } => {
    const counts = new Map<string, number>();
    const expires: string[] = [];
    return {
      minute: { limit: async () => ok },
      day: { limit: async () => ok },
      redis: {
        incr: async (k: string) => { const n = (counts.get(k) ?? 0) + 1; counts.set(k, n); return n; },
        expire: async (k: string) => { expires.push(k); return 1; },
      },
      counts,
      expires,
      ...over,
    };
  };
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it('allows, and uses the prefixed UTC-day global key with EXPIRE on first hit', async () => {
    const st = fakeStore();
    expect((await guardAiRequest(from('1.1.1.1'), NOW, {}, st)).status).toBe('ok');
    const key = `pass-game:ai:daily:${new Date(NOW).toISOString().slice(0, 10)}:global`;
    expect(st.counts.get(key)).toBe(1);
    expect(st.expires).toEqual([key]);
  });
  it('denies when Redis errors (fail closed)', async () => {
    const err = quiet();
    const st = fakeStore({ minute: { limit: async () => { throw new Error('boom'); } } });
    expect((await guardAiRequest(from('1.1.1.1'), NOW, {}, st)).status).toBe('limited');
    const st2 = fakeStore({ redis: { incr: async () => { throw new Error('boom'); }, expire: async () => 1 } });
    expect(await guardAiRequest(from('1.1.1.1'), NOW, {}, st2)).toMatchObject({ status: 'limited', reason: 'store-error' });
    err.mockRestore();
  });
  it('denies when Redis hangs past the timeout (fail closed)', async () => {
    vi.useFakeTimers();
    const err = quiet();
    const st = fakeStore({ minute: { limit: () => new Promise(() => {}) } });
    const p = guardAiRequest(from('1.1.1.1'), NOW, {}, st);
    await vi.advanceTimersByTimeAsync(LIMITS.storeTimeoutMs + 1);
    expect(await p).toMatchObject({ status: 'limited', reason: 'store-error' });
    err.mockRestore();
    vi.useRealTimers();
  });
  it('denies a per-IP limiter refusal with retryAfterSec', async () => {
    const st = fakeStore({ minute: { limit: async () => ({ success: false, reset: NOW + 12_000 }) } });
    expect(await guardAiRequest(from('1.1.1.1'), NOW, {}, st)).toEqual({ status: 'limited', reason: 'ip-minute', retryAfterSec: 12 });
  });
  it('denies once the global daily ceiling is spent', async () => {
    const st = fakeStore();
    for (let i = 0; i < LIMITS.globalPerDay; i++) {
      expect((await guardAiRequest(from('1.1.1.1'), NOW, {}, st)).status).toBe('ok');
    }
    expect(await guardAiRequest(from('2.2.2.2'), NOW, {}, st)).toMatchObject({ status: 'limited', reason: 'global-day' });
  });
  it('still honours the kill switch and cross-site check before touching Redis', async () => {
    const st = fakeStore({ minute: { limit: async () => { throw new Error('should not be called'); } } });
    expect(await guardAiRequest(from('1.1.1.1'), NOW, { PASS_AI_DISABLED: '1' }, st)).toEqual({ status: 'limited', reason: 'disabled' });
    expect((await guardAiRequest(from('1.1.1.1', { 'sec-fetch-site': 'cross-site' }), NOW, {}, st)).status).toBe('forbidden');
  });
});
