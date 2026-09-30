import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Keyed hashes for two jobs, both derived from the server's secret so no
 * extra secret has to be configured:
 *
 *  - Signing what the AI reader returned, so the confirm step can tell a
 *    genuine read from one a browser made up. Nothing is stored between the
 *    two steps; the browser carries the read and its signature.
 *  - Rate-limit buckets keyed by network address without storing it.
 */

const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function key(purpose: string): Buffer | null {
  const base = process.env.SUPABASE_SECRET_KEY || process.env.ANTHROPIC_API_KEY;
  if (!base) return null;
  return createHmac('sha256', base).update(`ioi/${purpose}/v1`).digest();
}

/** JSON with sorted keys, so the same data always signs the same way. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

export function signRead(payload: unknown, now = Date.now()): string | null {
  const k = key('plan-read');
  if (!k) return null;
  const mac = createHmac('sha256', k).update(`${now}.${canonical(payload)}`).digest('base64url');
  return `${now}.${mac}`;
}

export function verifyRead(payload: unknown, token: unknown, now = Date.now()): boolean {
  const k = key('plan-read');
  if (!k || typeof token !== 'string') return false;
  const [iat, mac] = token.split('.');
  const t = Number(iat);
  if (!Number.isFinite(t) || !mac || now - t > MAX_AGE_MS || t - now > 60_000) return false;
  const expected = createHmac('sha256', k).update(`${t}.${canonical(payload)}`).digest();
  const given = Buffer.from(mac, 'base64url');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** A short, stable, non-reversible label for a value (an IP address, say). */
export function bucketId(label: string, value: string): string | null {
  const k = key('rate-limit');
  if (!k) return null;
  return `${label}:${createHmac('sha256', k).update(value).digest('base64url').slice(0, 22)}`;
}
