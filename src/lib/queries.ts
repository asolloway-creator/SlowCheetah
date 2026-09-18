import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  periodToDateFrom,
  quarterToDateFrom,
  startOfPeriodInZone,
  type CompPlan,
  type PeriodToDate,
  type QuarterToDate,
  type QuarterlyKicker,
  type SubscriptionMode,
} from '@/lib/calc';

/** The rep's own calendar, not the server's — see startOfPeriodInZone's
 *  own comment in calc.ts. Falls back to UTC only on a visitor's very
 *  first request of a session, before SetTimeZoneCookie has had a chance
 *  to set it; every request after is correct. */
async function repTimeZone(): Promise<string> {
  const store = await cookies();
  return store.get('tz')?.value || 'UTC';
}

export type DealRow = {
  id: string;
  one_time_amount: number;
  subscription_amount: number;
  subscription_mode: SubscriptionMode;
  units: number;
  one_time_discount_pct: number;
  subscription_discount_pct: number;
  quota_credit: number;
  arr: number;
  commission_base: number;
  commission_earned: number;
  money_left_on_table: number;
  saas_commission: number;
  created_at: string;
};

/** The signed-in user, or null — pages fall back to demo mode when null. */
export async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const num = (v: unknown) => Number(v);

/** jsonb round-trips as a plain object or null — validate its shape rather
 *  than trust it, same caution `num()` already applies to every other
 *  column here. Malformed data (a hand-edited row, a future schema change)
 *  degrades to "no kicker" instead of a broken plan. */
function parseKicker(v: unknown): QuarterlyKicker | null {
  if (!v || typeof v !== 'object') return null;
  const k = v as { target?: unknown; tiers?: unknown };
  const target = num(k.target);
  const tiers = Array.isArray(k.tiers) ? k.tiers : [];
  if (!(target > 0) || tiers.length !== 2) return null;
  const parsed = tiers.map((t) => ({
    attainmentPct: num((t as { attainmentPct?: unknown })?.attainmentPct),
    kickerPct: num((t as { kickerPct?: unknown })?.kickerPct),
  }));
  if (parsed.some((t) => !(t.attainmentPct > 0) || !Number.isFinite(t.kickerPct))) return null;
  return { target, tiers: [parsed[0], parsed[1]] };
}

export async function getCompPlan(userId: string): Promise<CompPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('comp_plans').select('*').eq('user_id', userId).maybeSingle();
  // A failed fetch is not the same thing as "this user has no plan yet" —
  // the two were conflated here, and every page-load caller treats a null
  // return as license to redirect to /plan. A returning user hitting a
  // transient Supabase failure would land back on plan setup looking like
  // their account was wiped, instead of seeing an error. Thrown (like
  // listDeals already does below) so it surfaces through error.tsx instead.
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    role_name: String(data.role_name),
    period: data.period,
    quota_basis: data.quota_basis,
    quota: num(data.quota),
    commission_style: data.commission_style,
    base_rate: num(data.base_rate),
    accelerator_style: data.accelerator_style,
    accelerator_threshold: num(data.accelerator_threshold),
    accelerator_rate: num(data.accelerator_rate),
    one_time_weight: num(data.one_time_weight),
    quarterly_kicker: parseKicker(data.quarterly_kicker),
  };
}

function toDealRow(d: Record<string, unknown>): DealRow {
  return {
    id: String(d.id),
    one_time_amount: num(d.one_time_amount),
    subscription_amount: num(d.subscription_amount),
    subscription_mode: d.subscription_mode as SubscriptionMode,
    units: num(d.units),
    one_time_discount_pct: num(d.one_time_discount_pct),
    subscription_discount_pct: num(d.subscription_discount_pct),
    quota_credit: num(d.quota_credit),
    arr: num(d.arr),
    commission_base: num(d.commission_base),
    commission_earned: num(d.commission_earned),
    money_left_on_table: num(d.money_left_on_table),
    saas_commission: num(d.saas_commission),
    created_at: String(d.created_at),
  };
}

export async function listDeals(userId: string, opts?: { since?: Date }): Promise<DealRow[]> {
  const supabase = await createClient();
  let q = supabase.from('deals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (opts?.since) q = q.gte('created_at', opts.since.toISOString());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDealRow);
}

export async function getPeriodToDate(
  userId: string,
  plan: CompPlan,
): Promise<PeriodToDate & { deals: DealRow[] }> {
  const tz = await repTimeZone();
  const deals = await listDeals(userId, { since: startOfPeriodInZone(plan.period, tz) });
  return { ...periodToDateFrom(deals), deals };
}

/** Always the calendar quarter, independent of plan.period — reuses
 *  listDeals unmodified, just with a different `since`. Only called when
 *  a plan actually has a quarterly_kicker configured. */
export async function getQuarterToDate(userId: string): Promise<QuarterToDate> {
  const tz = await repTimeZone();
  const deals = await listDeals(userId, { since: startOfPeriodInZone('quarter', tz) });
  return quarterToDateFrom(deals);
}
