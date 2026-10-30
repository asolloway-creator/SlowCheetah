import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { parseTargets, type Targets } from '@/components/discounts';
import {
  FORECASTS,
  currentOpening,
  periodKeyInZone,
  periodToDateFrom,
  planForPeriod,
  quarterToDateFrom,
  startOfPeriodInZone,
  withPeriodOpening,
  withQuarterOpening,
  type CompPlan,
  type Opening,
  type PeriodToDate,
  type QuarterToDate,
  type AcceleratorStep,
  type QuarterlyKicker,
  type QuarterlyKickerTier,
  type DealAccount,
  type DealInput,
  type Forecast,
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
  /** v14: a hardware line, on a plan that pays hardware its own rate.
   *  Absent on rows from before it existed (the browser store), meaning none. */
  hardware_amount?: number;
  hardware_discount_pct?: number;
  hardware_commission?: number;
  created_at: string;
  /** v15: the rep's own name for the deal (deal_labels), or ''. */
  name: string;
  /** v17: the account it belongs to, if any. */
  account_id?: string | null;
  /** v20: 'upsell' for booked ARR entered without a quote (no discount data). */
  kind?: 'deal' | 'upsell';
};

/** The rep's discount targets (comp_plans.targets). Never throws: where they
 *  can't be read the page opens without them. */
export async function getTargets(userId: string): Promise<Targets> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('comp_plans').select('targets').eq('user_id', userId).maybeSingle();
    if (error || !data) return {};
    return parseTargets((data as { targets?: unknown }).targets);
  } catch {
    return {};
  }
}

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

/** comp_plans.accelerator_steps (v13), validated like the kicker: each step
 *  past the one before it. Anything malformed reads as no further steps. */
function parseSteps(v: unknown, first: number): AcceleratorStep[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const steps = v.slice(0, 3).map((s) => {
    const raw = (s ?? {}) as { threshold?: unknown; rate?: unknown };
    return { threshold: num(raw.threshold), rate: num(raw.rate) };
  });
  let last = first;
  for (const s of steps) {
    if (!(s.threshold > last) || !Number.isFinite(s.rate) || s.rate < 0) return null;
    last = s.threshold;
  }
  return steps;
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
  const steps = data.accelerator_style === 'none' ? null : parseSteps(data.accelerator_steps, num(data.accelerator_threshold));
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
    ...(steps ? { accelerator_steps: steps } : {}),
    one_time_weight: num(data.one_time_weight),
    // v14: hardware's own flat rate, when the plan has one.
    ...(data.hardware_rate !== null && data.hardware_rate !== undefined && Number.isFinite(num(data.hardware_rate))
      ? { hardware_rate: num(data.hardware_rate) }
      : {}),
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
    hardware_amount: num(d.hardware_amount ?? 0),
    hardware_discount_pct: num(d.hardware_discount_pct ?? 0),
    hardware_commission: num(d.hardware_commission ?? 0),
    created_at: String(d.created_at),
    name: labelOf(d.deal_labels),
    account_id: d.account_id ? String(d.account_id) : null,
    kind: d.kind === 'upsell' ? 'upsell' : 'deal',
  };
}

/** deal_labels comes back as an object (one-to-one) or a one-row array. */
function labelOf(v: unknown): string {
  const row = Array.isArray(v) ? v[0] : v;
  return row && typeof row === 'object' && typeof (row as { name?: unknown }).name === 'string' ? (row as { name: string }).name : '';
}

export async function listDeals(userId: string, opts?: { since?: Date }): Promise<DealRow[]> {
  const supabase = await createClient();
  // With each deal's name (v15 deal_labels); without, if that can't be read,
  // so a missing table never takes the page down.
  const run = (cols: string) => {
    let q = supabase.from('deals').select(cols).eq('user_id', userId).order('created_at', { ascending: false });
    if (opts?.since) q = q.gte('created_at', opts.since.toISOString());
    return q;
  };
  let { data, error } = await run('*, deal_labels(name)');
  if (error) ({ data, error } = await run('*'));
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toDealRow);
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
      // Lost quotes are kept (v18) for the record, off the open list.
      .eq('status', 'open')
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
        ...(num(d.hardware_amount ?? 0) > 0
          ? { hardware: num(d.hardware_amount), hardwareDiscountPct: num(d.hardware_discount_pct ?? 0) }
          : {}),
      },
      createdAt: String(d.created_at),
      updatedAt: String(d.updated_at),
      accountId: d.account_id ? String(d.account_id) : null,
      forecast: FORECASTS.includes(d.forecast as Forecast) ? (d.forecast as Forecast) : null,
      offer: d.offer_expires && d.offer_revert ? { expires: String(d.offer_expires), original: dealFromJson(d.offer_revert) } : null,
    }));
  } catch {
    return [];
  }
}

/** A deal saved as jsonb (a sign-by offer's original numbers), checked. */
function dealFromJson(v: unknown): DealInput {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    oneTime: num(o.oneTime ?? 0),
    subscription: num(o.subscription ?? 0),
    subMode: o.subMode === 'acv' ? 'acv' : 'mrr',
    units: Math.max(1, num(o.units ?? 1)),
    oneTimeDiscountPct: num(o.oneTimeDiscountPct ?? 0),
    subscriptionDiscountPct: num(o.subscriptionDiscountPct ?? 0),
    ...(num(o.hardware ?? 0) > 0 ? { hardware: num(o.hardware), hardwareDiscountPct: num(o.hardwareDiscountPct ?? 0) } : {}),
  };
}

/** The rep's accounts (v17): buyers with several deals. Never throws. */
export async function listAccounts(userId: string): Promise<DealAccount[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('deal_accounts').select('id, name, one_decision').eq('user_id', userId);
    if (error || !data) return [];
    return data.map((a: Record<string, unknown>) => ({ id: String(a.id), name: String(a.name ?? ''), oneDecision: a.one_decision !== false }));
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
  const rateAdjust = typeof o.rateAdjust === 'number' && Number.isFinite(o.rateAdjust) && Math.abs(o.rateAdjust) <= 50 ? o.rateAdjust : null;
  return { periodKey: o.periodKey, credit, quarterKey: o.quarterKey, quarterArr, entered: o.entered === true, rateAdjust };
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
  const opening = currentOpening(saved, key);
  return { ...withPeriodOpening(planForPeriod(plan, opening), periodToDateFrom(deals), saved, key), deals, opening };
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
