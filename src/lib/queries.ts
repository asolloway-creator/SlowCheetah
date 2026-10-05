import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  currentOpening,
  periodKeyInZone,
  periodToDateFrom,
  quarterToDateFrom,
  startOfPeriodInZone,
  withPeriodOpening,
  withQuarterOpening,
  type CompPlan,
  type Opening,
  type PeriodToDate,
  type QuarterToDate,
  type QuarterlyKicker,
  type QuarterlyKickerTier,
  type Quote,
  type SubscriptionMode,
} from '@/lib/calc';

/** The rep's own calendar, not the server's — see startOfPeriodInZone's
 *  own comment in calc.ts. Falls back to UTC only on a visitor's very
 *  first request of a session, before SetTimeZoneCookie has had a chance
 *  to set it; every request after is correct. */
export async function repTimeZone(): Promise<string> {
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
  if (!(target > 0) || tiers.length < 1 || tiers.length > 2) return null;
  const parsed = tiers.map((t) => {
    const raw = (t ?? {}) as { attainmentPct?: unknown; kickerPct?: unknown; amount?: unknown };
    const tier: QuarterlyKickerTier = { attainmentPct: num(raw.attainmentPct), kickerPct: num(raw.kickerPct ?? 0) };
    // A fixed-amount tier; plans saved before those existed have no amount.
    if (raw.amount !== undefined && raw.amount !== null) tier.amount = num(raw.amount);
    return tier;
  });
  if (parsed.some((t) => !(t.attainmentPct > 0) || !Number.isFinite(t.kickerPct) || (t.amount !== undefined && !(t.amount >= 0)))) return null;
  return { target, tiers: parsed.length === 1 ? [parsed[0]] : [parsed[0], parsed[1]] };
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
  return toCompPlan(data);
}

/** A comp_plans row (or its jsonb twin) as a CompPlan. */
export function toCompPlan(data: Record<string, unknown>): CompPlan {
  return {
    role_name: String(data.role_name),
    period: data.period as CompPlan['period'],
    quota_basis: data.quota_basis as CompPlan['quota_basis'],
    quota: num(data.quota),
    commission_style: data.commission_style as CompPlan['commission_style'],
    base_rate: num(data.base_rate),
    accelerator_style: data.accelerator_style as CompPlan['accelerator_style'],
    accelerator_threshold: num(data.accelerator_threshold),
    accelerator_rate: num(data.accelerator_rate),
    one_time_weight: num(data.one_time_weight),
    quarterly_kicker: parseKicker(data.quarterly_kicker),
    industry: data.industry ? String(data.industry) : null,
    company_size_band: data.company_size_band ? String(data.company_size_band) : null,
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

/**
 * The rep's open quotes, most recently worked first. Never throws: where
 * they can't be read the page opens without them rather than failing.
 */
export async function listQuotes(userId: string): Promise<Quote[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map((d: Record<string, unknown>) => ({
      id: String(d.id),
      name: String(d.name ?? ''),
      deal: {
        oneTime: num(d.one_time_amount),
        subscription: num(d.subscription_amount),
        subMode: d.subscription_mode === 'acv' ? 'acv' : 'mrr',
        units: Math.max(1, num(d.units)),
        oneTimeDiscountPct: num(d.one_time_discount_pct),
        subscriptionDiscountPct: num(d.subscription_discount_pct),
      },
      createdAt: String(d.created_at),
      updatedAt: String(d.updated_at),
    }));
  } catch {
    return [];
  }
}

const KEY = /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/;

/** comp_plans.opening as an Opening, or null when it's missing or malformed
 *  (same caution as parseKicker). */
function parseOpening(v: unknown): Opening | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const credit = num(o.credit);
  const quarterArr = o.quarterArr === null || o.quarterArr === undefined ? null : num(o.quarterArr);
  if (typeof o.periodKey !== 'string' || !KEY.test(o.periodKey)) return null;
  if (typeof o.quarterKey !== 'string' || !KEY.test(o.quarterKey)) return null;
  if (!(credit >= 0) || (quarterArr !== null && !(quarterArr >= 0))) return null;
  return { periodKey: o.periodKey, credit, quarterKey: o.quarterKey, quarterArr };
}

/**
 * The rep's starting point: what they'd booked before IOI (calc.ts Opening).
 * Never throws. Where it can't be read, the rep is shown from zero rather than
 * the page failing, the same as before starting points existed.
 */
export async function getOpening(userId: string): Promise<Opening | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('comp_plans').select('opening').eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    return parseOpening((data as { opening?: unknown }).opening);
  } catch {
    return null;
  }
}

/** The period so far: deals booked in IOI plus the starting point, when it
 *  was entered for this period. `opening` is that starting point, or null. */
export async function getPeriodToDate(
  userId: string,
  plan: CompPlan,
): Promise<PeriodToDate & { deals: DealRow[]; opening: Opening | null }> {
  const tz = await repTimeZone();
  const key = periodKeyInZone(plan.period, tz);
  const [deals, saved] = await Promise.all([
    listDeals(userId, { since: startOfPeriodInZone(plan.period, tz) }),
    getOpening(userId),
  ]);
  return { ...withPeriodOpening(plan, periodToDateFrom(deals), saved, key), deals, opening: currentOpening(saved, key) };
}

/** Always the calendar quarter, independent of plan.period — reuses
 *  listDeals unmodified, just with a different `since`, plus the starting
 *  point's quarter ARR. Only called when a plan actually has a
 *  quarterly_kicker configured. */
export async function getQuarterToDate(userId: string, plan: CompPlan): Promise<QuarterToDate> {
  const tz = await repTimeZone();
  const [deals, saved] = await Promise.all([
    listDeals(userId, { since: startOfPeriodInZone('quarter', tz) }),
    getOpening(userId),
  ]);
  return withQuarterOpening(plan, quarterToDateFrom(deals), saved, periodKeyInZone('quarter', tz));
}
