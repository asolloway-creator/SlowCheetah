import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';
import { bucketId } from './token';

/** Set on the server, never trusted from the browser, same as /api/events. */
export const ENV =
  process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const BOT = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|preview/i;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > maxBytes) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function clientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
}

type Rule = { bucket: string | null; windowSeconds: number; max: number };

/**
 * True when every rule still has room. Counts against all of them. Fails
 * closed outside development: with no way to count, the paid reader stays
 * off rather than open.
 */
export async function withinLimits(rules: Rule[]): Promise<boolean> {
  const db = serviceClient();
  if (!db) return ENV === 'development';
  let ok = true;
  for (const r of rules) {
    if (!r.bucket) continue;
    const { data, error } = await db.rpc('take_rate_limit', {
      p_bucket: r.bucket,
      p_window_seconds: r.windowSeconds,
      p_max: r.max,
    });
    if (error) return ENV === 'development';
    if (data !== true) ok = false;
  }
  return ok;
}

const HOUR = 3600;
const DAY = 86400;

/** The AI reader's limits: per browser, per network, and a daily ceiling for everyone. */
export function readerLimits(request: Request, visitorId: string): Rule[] {
  const ip = clientIp(request);
  const v = bucketId('read:v', visitorId);
  const n = ip ? bucketId('read:ip', ip) : null;
  return [
    { bucket: v, windowSeconds: HOUR, max: 12 },
    { bucket: v && `${v}:day`, windowSeconds: DAY, max: 30 },
    { bucket: n, windowSeconds: HOUR, max: 30 },
    { bucket: n && `${n}:day`, windowSeconds: DAY, max: 60 },
    { bucket: 'read:all', windowSeconds: DAY, max: 400 },
  ];
}

/** Saving plans: generous, but bounded per browser and per network. */
export function confirmLimits(request: Request, visitorId: string): Rule[] {
  const ip = clientIp(request);
  return [
    { bucket: bucketId('confirm:v', visitorId), windowSeconds: DAY, max: 20 },
    { bucket: ip ? bucketId('confirm:ip', ip) : null, windowSeconds: DAY, max: 60 },
  ];
}

/** The signed-in user's id, if there is one. Never required. */
export async function sessionUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
