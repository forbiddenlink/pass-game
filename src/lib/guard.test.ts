import { beforeEach, describe, expect, it } from 'vitest';
import { LIMITS, aiDisabled, clientIp, guardAiRequest, isCrossSite, resetGuard } from './guard';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://pass-game-six.vercel.app/api/judge', { method: 'POST', headers });
const from = (ip: string, extra: Record<string, string> = {}) => req({ 'x-forwarded-for': ip, ...extra });
const NOW = 1_000_000_000_000;

beforeEach(() => resetGuard());

describe('clientIp', () => {
  it('takes the first x-forwarded-for hop', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip, then unknown', () => {
    expect(clientIp(req({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(req())).toBe('unknown');
  });
});

describe('isCrossSite', () => {
  it('allows same-origin and header-less (non-browser) requests', () => {
    expect(isCrossSite(req({ 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossSite(req({ 'sec-fetch-site': 'none' }))).toBe(false);
    expect(isCrossSite(req())).toBe(false);
    expect(isCrossSite(req({ origin: 'https://pass-game-six.vercel.app', host: 'pass-game-six.vercel.app' }))).toBe(false);
  });
  it('rejects cross-site and same-site fetches', () => {
    expect(isCrossSite(req({ 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossSite(req({ 'sec-fetch-site': 'same-site' }))).toBe(true);
  });
  it('rejects a foreign or malformed Origin when Sec-Fetch-Site is absent', () => {
    expect(isCrossSite(req({ origin: 'https://evil.example', host: 'pass-game-six.vercel.app' }))).toBe(true);
    expect(isCrossSite(req({ origin: 'null', host: 'pass-game-six.vercel.app' }))).toBe(true);
  });
  it('prefers x-forwarded-host when comparing Origin', () => {
    expect(isCrossSite(req({ origin: 'https://pass-game-six.vercel.app', host: 'internal:3000', 'x-forwarded-host': 'pass-game-six.vercel.app' }))).toBe(false);
  });
});

describe('kill switch', () => {
  it('reads PASS_AI_DISABLED', () => {
    expect(aiDisabled({ PASS_AI_DISABLED: '1' })).toBe(true);
    expect(aiDisabled({ PASS_AI_DISABLED: 'true' })).toBe(true);
    expect(aiDisabled({ PASS_AI_DISABLED: '0' })).toBe(false);
    expect(aiDisabled({})).toBe(false);
  });
  it('limits every request, whatever the IP', () => {
    expect(guardAiRequest(from('1.1.1.1'), NOW, { PASS_AI_DISABLED: '1' })).toEqual({ status: 'limited', reason: 'disabled' });
  });
  it('still rejects cross-site first', () => {
    expect(guardAiRequest(from('1.1.1.1', { 'sec-fetch-site': 'cross-site' }), NOW, { PASS_AI_DISABLED: '1' }).status).toBe('forbidden');
  });
});

describe('per-IP limits', () => {
  it('allows perIpPerMinute then limits that IP only', () => {
    for (let i = 0; i < LIMITS.perIpPerMinute; i++) expect(guardAiRequest(from('1.1.1.1'), NOW + i, {}).status).toBe('ok');
    expect(guardAiRequest(from('1.1.1.1'), NOW + 100, {})).toEqual({ status: 'limited', reason: 'ip-minute' });
    expect(guardAiRequest(from('2.2.2.2'), NOW + 100, {}).status).toBe('ok');
  });
  it('recovers after the minute window', () => {
    for (let i = 0; i < LIMITS.perIpPerMinute; i++) guardAiRequest(from('1.1.1.1'), NOW, {});
    expect(guardAiRequest(from('1.1.1.1'), NOW + 60_001, {}).status).toBe('ok');
  });
  it('enforces the daily cap across minutes, and resets after 24h', () => {
    let t = NOW;
    for (let i = 0; i < LIMITS.perIpPerDay; i++) {
      expect(guardAiRequest(from('1.1.1.1'), t, {}).status).toBe('ok');
      t += 61_000; // a fresh minute window each time, so only the day cap bites
    }
    expect(guardAiRequest(from('1.1.1.1'), t, {})).toEqual({ status: 'limited', reason: 'ip-day' });
    expect(guardAiRequest(from('1.1.1.1'), NOW + 24 * 60 * 60_000 + 1, {}).status).toBe('ok');
  });
  it('lets a normal full night through (about 32 calls over several minutes)', () => {
    let t = NOW;
    for (let i = 0; i < 32; i++) {
      expect(guardAiRequest(from('9.9.9.9'), t, {}).status).toBe('ok');
      t += 15_000; // 4 calls a minute
    }
  });
});

describe('global per-instance cap', () => {
  it('limits all IPs once the daily total is spent', () => {
    // distinct IPs so no per-IP limit fires first
    for (let i = 0; i < LIMITS.globalPerDay; i++) {
      expect(guardAiRequest(from(`10.${i >> 16}.${(i >> 8) & 255}.${i & 255}`), NOW, {}).status).toBe('ok');
    }
    expect(guardAiRequest(from('200.200.200.200'), NOW, {})).toEqual({ status: 'limited', reason: 'global-day' });
    // resets after 24h
    expect(guardAiRequest(from('200.200.200.200'), NOW + 24 * 60 * 60_000 + 1, {}).status).toBe('ok');
  });
  it('does not consume the global budget for a request refused by a per-IP limit', () => {
    for (let i = 0; i < LIMITS.perIpPerMinute; i++) guardAiRequest(from('1.1.1.1'), NOW, {});
    for (let i = 0; i < 50; i++) guardAiRequest(from('1.1.1.1'), NOW, {});
    // only perIpPerMinute requests were counted globally; the rest of the budget is intact
    let ok = 0;
    for (let i = 0; i < LIMITS.globalPerDay; i++) {
      if (guardAiRequest(from(`11.${i >> 16}.${(i >> 8) & 255}.${i & 255}`), NOW, {}).status === 'ok') ok++;
    }
    expect(ok).toBe(LIMITS.globalPerDay - LIMITS.perIpPerMinute);
  });
});
