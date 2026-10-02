/** Input hygiene for the Gemini routes — SERVER ONLY. No dependency; the shapes are tiny. */
import { THEME_TAGS, type ThemeTag } from './puzzle';

/** Largest request body we will parse. Real payloads are a few KB (transcript <= 4000 chars). */
export const MAX_BODY_BYTES = 16 * 1024;

/** Read a JSON object body, or {} when it is missing, oversized, malformed, or not an object. */
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const declared = Number(req.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return {};
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return {};
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A string capped at `max` chars; anything else becomes ''. */
export const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** An integer clamped to [min, max]; anything else becomes `fallback`. */
export function int(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : fallback;
}

/** A number clamped to [min, max]; anything else becomes `fallback`. */
export function num(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

/** Theme must be one of the game's own tags; otherwise undefined (route then uses the offline bank). */
export const theme = (v: unknown): ThemeTag | undefined =>
  typeof v === 'string' && (THEME_TAGS as readonly string[]).includes(v) ? (v as ThemeTag) : undefined;

export const persona = (v: unknown): 'patient' | 'hard' | undefined => (v === 'patient' || v === 'hard' ? v : undefined);

export const ENDINGS = ['A', 'B', 'C', 'OFF'] as const;
export const ending = (v: unknown): (typeof ENDINGS)[number] =>
  (ENDINGS as readonly unknown[]).includes(v) ? (v as (typeof ENDINGS)[number]) : 'OFF';
