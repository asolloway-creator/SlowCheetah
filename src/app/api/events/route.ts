import { createClient } from '@supabase/supabase-js';

const NAMES = new Set(['visit', 'slider_drag', 'bonus_line_crossed', 'plan_form_opened', 'plan_saved', 'deal_booked', 'signin_started']);
const CONTEXTS = new Set(['site', 'sample', 'own', 'account']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|preview/i;

// Set on the server, never trusted from the browser: production traffic is
// the only traffic the dashboard counts by default.
const ENV =
  process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development';

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Anonymous product events from src/lib/track.ts. Write-only: nothing here reads back. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 2000) return new Response(null, { status: 413 });
  if (BOT.test(request.headers.get('user-agent') ?? '')) return new Response(null, { status: 204 });

  let b: Record<string, unknown>;
  try {
    b = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (
    !NAMES.has(String(b.name)) ||
    !CONTEXTS.has(String(b.context)) ||
    !UUID.test(String(b.visitorId)) ||
    !UUID.test(String(b.sessionId))
  ) {
    return new Response(null, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from('events').insert({
    name: b.name,
    context: b.context,
    visitor_id: b.visitorId,
    session_id: b.sessionId,
    path: text(b.path, 200),
    referrer_host: text(b.referrerHost, 200)?.toLowerCase() ?? null,
    utm_source: text(b.utmSource, 100),
    utm_medium: text(b.utmMedium, 100),
    utm_campaign: text(b.utmCampaign, 100),
    device: b.device === 'mobile' || b.device === 'desktop' ? b.device : null,
    env: ENV,
    internal: b.internal === true,
  });
  if (error) return new Response(null, { status: 500 });
  return new Response(null, { status: 204 });
}
