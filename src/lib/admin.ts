import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompPlan } from '@/lib/calc';
import { currentUser, repTimeZone, toCompPlan } from '@/lib/queries';

/**
 * The admin dashboard's data. Every read runs as the signed-in admin: the
 * database's own rules (is_admin(), admin_* functions, "admins read"
 * policies) decide what's visible, so nothing here holds a master key.
 */

export type Range = '7d' | '30d' | 'all';
export const RANGES: [Range, string][] = [
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['all', 'All time'],
];
export const parseRange = (v?: string): Range => (v === '7d' || v === 'all' ? v : '30d');

export type Env = 'production' | 'preview' | 'development';
export const parseEnv = (v?: string): Env => (v === 'preview' || v === 'development' ? v : 'production');

const DAY = 86_400_000;
/** Milliseconds timestamp `days` before now. */
export const daysAgo = (days: number) => Date.now() - days * DAY;

export function sinceOf(range: Range, now = Date.now()): Date {
  if (range === 'all') return new Date(0);
  return new Date(now - (range === '7d' ? 7 : 30) * DAY);
}

/** Signed in and on the admin list, or a plain 404: the page never admits it exists. */
export async function requireAdmin() {
  const { supabase, user } = await currentUser();
  if (!user) notFound();
  const { data, error } = await supabase.rpc('is_admin');
  if (error || data !== true) notFound();
  return { supabase, user };
}

/** The tz cookie is set by the browser; only trust it if it's a real zone. */
export async function adminTimeZone(): Promise<string> {
  const tz = await repTimeZone();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

export type Account = {
  id: string;
  number: number;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  plan: CompPlan | null;
  deals: number;
  commission: number;
  lastDealAt: string | null;
};

/** Every account in signup order; `number` is the stable "User N" label. */
export async function getAccounts(supabase: SupabaseClient): Promise<Account[]> {
  const { data, error } = await supabase.rpc('admin_accounts');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r, i) => ({
    id: String(r.id),
    number: i + 1,
    email: String(r.email ?? ''),
    createdAt: String(r.created_at),
    lastSignInAt: r.last_sign_in_at ? String(r.last_sign_in_at) : null,
    isAdmin: r.is_admin === true,
    plan: r.plan ? toCompPlan(r.plan as Record<string, unknown>) : null,
    deals: Number(r.deals ?? 0),
    commission: Number(r.commission ?? 0),
    lastDealAt: r.last_deal_at ? String(r.last_deal_at) : null,
  }));
}

export type Step = { name: string; context: string; visitors: number; events: number };
export type Traffic = {
  visitors: number;
  sessions: number;
  pageViews: number;
  journey: {
    visited: number;
    sampleDrag: number;
    sampleCross: number;
    formOpened: number;
    ownSaved: number;
    signinStarted: number;
  };
  steps: Step[];
  sources: { source: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  daily: { day: string; visitors: number; own: number }[];
  lastEventAt: string | null;
  firstEventAt: string | null;
};

export async function getTraffic(supabase: SupabaseClient, since: Date, tz: string, env: Env): Promise<Traffic> {
  const { data, error } = await supabase.rpc('admin_traffic', { since: since.toISOString(), tz, env_filter: env });
  if (error) throw new Error(error.message);
  const t = (data ?? {}) as Record<string, unknown>;
  const j = (t.journey ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0);
  return {
    visitors: n(t.visitors),
    sessions: n(t.sessions),
    pageViews: n(t.page_views),
    journey: {
      visited: n(j.visited),
      sampleDrag: n(j.sample_drag),
      sampleCross: n(j.sample_cross),
      formOpened: n(j.form_opened),
      ownSaved: n(j.own_saved),
      signinStarted: n(j.signin_started),
    },
    steps: ((t.steps ?? []) as Record<string, unknown>[]).map((s) => ({
      name: String(s.name),
      context: String(s.context),
      visitors: n(s.visitors),
      events: n(s.events),
    })),
    sources: ((t.sources ?? []) as Record<string, unknown>[]).map((s) => ({ source: String(s.source), visitors: n(s.visitors) })),
    devices: ((t.devices ?? []) as Record<string, unknown>[]).map((s) => ({ device: String(s.device), visitors: n(s.visitors) })),
    daily: ((t.daily ?? []) as Record<string, unknown>[]).map((s) => ({ day: String(s.day), visitors: n(s.visitors), own: n(s.own) })),
    lastEventAt: t.last_event_at ? String(t.last_event_at) : null,
    firstEventAt: t.first_event_at ? String(t.first_event_at) : null,
  };
}

/** Visitors and events for one (moment, context) pair, zero when it never happened. */
export function stepOf(t: Traffic, name: string, context: string) {
  return t.steps.find((s) => s.name === name && s.context === context) ?? { name, context, visitors: 0, events: 0 };
}
