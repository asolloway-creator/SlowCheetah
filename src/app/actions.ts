'use server';

import { revalidatePath } from 'next/cache';
import { currentUser, getCompPlan, getOpening, getPeriodToDate, getTargets, repTimeZone } from '@/lib/queries';
import { LINES, type Line } from '@/components/discounts';
import {
  calc,
  calendarInZone,
  COMPANY_SIZE_BANDS,
  middayInZone,
  planForPeriod,
  needsQuarterArr,
  periodKeyInZone,
  type CompPlan,
  type DealInput,
  FORECASTS,
  LOST_REASONS,
  type Forecast,
  type LostReason,
  type Opening,
  type OpeningInput,
  type AcceleratorStep,
  type QuarterlyKickerTier,
} from '@/lib/calc';
import { serviceClient } from '@/lib/supabase/service';

export type Result = { error?: string };

const clampPct = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
const money = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

/** A deal as the browser sent it, cleaned the same way every save is. */
function cleanDeal(input: DealInput): DealInput {
  return {
    oneTime: money(input.oneTime),
    subscription: money(input.subscription),
    subMode: input.subMode === 'acv' ? 'acv' : 'mrr',
    units: Math.max(1, Math.round(Number(input.units) || 1)),
    oneTimeDiscountPct: clampPct(input.oneTimeDiscountPct),
    subscriptionDiscountPct: clampPct(input.subscriptionDiscountPct),
    hardware: money(Number(input.hardware ?? 0)),
    hardwareDiscountPct: clampPct(Number(input.hardwareDiscountPct ?? 0)),
  };
}

/** Nothing on it: no one-time, subscription or hardware line. */
const isBlank = (deal: DealInput) => deal.oneTime === 0 && deal.subscription === 0 && !((deal.hardware ?? 0) > 0);

/** A deal's stored columns, priced by `r`. */
const dealColumns = (deal: DealInput, r: ReturnType<typeof calc>) => ({
  one_time_amount: deal.oneTime,
  subscription_amount: deal.subscription,
  subscription_mode: deal.subMode,
  units: deal.units,
  one_time_discount_pct: deal.oneTimeDiscountPct,
  subscription_discount_pct: deal.subscriptionDiscountPct,
  hardware_amount: deal.hardware ?? 0,
  hardware_discount_pct: deal.hardwareDiscountPct ?? 0,
  quota_credit: Number(r.credit.toFixed(2)),
  arr: Number(r.subAnnual.toFixed(2)),
  commission_base: Number(r.commissionBase.toFixed(2)),
  commission_earned: Number(r.commissionEffective.toFixed(2)),
  money_left_on_table: Number(r.lost.toFixed(2)),
  saas_commission: Number(r.saasCommissionEffective.toFixed(2)),
  hardware_commission: Number(r.hardwareCommission.toFixed(2)),
});

/**
 * The account a deal belongs to, as the card sends it. `id` for one that
 * exists; otherwise a new one is made with `name`, and `from` (the deal or
 * quote it was started from) joins it too. `null` takes the deal out of any
 * account; leaving the field out leaves its account as it is.
 */
export type AccountMeta = {
  id?: string | null;
  name?: string;
  oneDecision?: boolean;
  from?: { kind: 'quote' | 'deal'; id: string } | null;
} | null;

/** What the rep adds when booking: the deal's name, the day it was booked,
 *  and its account. */
export type BookMeta = { name?: string; bookedOn?: string; account?: AccountMeta; kind?: 'deal' | 'upsell' };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dealName = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

/**
 * Prices a deal against the period as it stands without `excludeId` (the
 * deal being edited), and works out when it was booked: today unless the rep
 * picked an earlier day this period. Shared by booking and editing.
 */
async function priceForBooking(userId: string, input: DealInput, meta: BookMeta | undefined, excludeId?: string) {
  let plan: CompPlan | null;
  try {
    plan = await getCompPlan(userId);
  } catch {
    return { error: 'Could not load your comp plan. Try again in a moment.' } as const;
  }
  if (!plan) return { error: 'Set up your comp plan before saving a deal.' } as const;
  const compPlan = plan;

  const deal = cleanDeal(input);
  if (isBlank(deal)) return { error: 'Enter at least one line item before saving.' } as const;

  const tz = await repTimeZone();
  const cal = calendarInZone(compPlan.period, tz);
  const bookedOn = meta?.bookedOn && DAY.test(meta.bookedOn) ? meta.bookedOn : cal.today;
  if (bookedOn > cal.today) return { error: 'Pick today or an earlier day for when it was booked.' } as const;
  if (bookedOn < cal.periodStart) return { error: 'Pick a day in this period. Deals from earlier periods go in what you’d booked before IOI.' } as const;

  // Recompute against the live period rather than trusting the browser.
  //
  // rate_switch specifically has no self-healing read (unlike retro_bump,
  // whose period payout is recomputed live from the pool each time — see
  // periodSummary in calc.ts): each deal's commission_earned is fixed
  // forever at whatever it was computed against when it was inserted, and
  // the period total is a plain sum of those. Two saves for the same user
  // landing close together (two tabs, phone + laptop) can both read the
  // same pre-crossing ptd and both get stored at the base rate even
  // though their combined credit crosses the threshold — a permanent
  // underpayment, not just a stale read.
  //
  // A real fix needs the read-then-insert to be atomic, which isn't
  // reachable through a plain PostgREST insert without porting this
  // engine into a database function. This is the pragmatic middle
  // ground: read ptd twice, back to back, right before inserting — if
  // creditBooked is identical both times, nothing landed in the gap and
  // r is safe; if it moved, recompute against the newer read and check
  // again. Not a lock, but it shrinks the race window from the whole
  // request down to the gap between two reads, and a few attempts covers
  // all but a genuinely simultaneous double-submit.
  async function readPtd() {
    try {
      const all = await getPeriodToDate(userId, compPlan);
      if (!excludeId) return all;
      // Editing: the period as it stands without this deal's old numbers.
      const without = all.deals.find((d) => d.id === excludeId);
      if (!without) return all;
      return {
        ...all,
        creditBooked: all.creditBooked - without.quota_credit,
        commissionBooked: all.commissionBooked - without.commission_base,
        earnedBooked: all.earnedBooked - without.commission_earned,
        hardwareBooked: (all.hardwareBooked ?? 0) - (without.hardware_commission ?? 0),
      };
    } catch {
      return null;
    }
  }
  let ptd = await readPtd();
  if (!ptd) return { error: 'Could not load where you stand this period. Try again in a moment.' } as const;
  // The rate this period, with the rep's adjustment from their statement.
  const effective = planForPeriod(compPlan, ptd.opening);
  let r = calc(effective, deal, ptd);
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    const confirm = await readPtd();
    if (!confirm) return { error: 'Could not load where you stand this period. Try again in a moment.' } as const;
    if (confirm.creditBooked === ptd.creditBooked) break;
    ptd = confirm;
    r = calc(effective, deal, ptd);
  }
  const createdAt = bookedOn === cal.today ? null : middayInZone(bookedOn, tz).toISOString();
  return { deal, r, createdAt, name: dealName(meta?.name) } as const;
}

/** Writes (or clears) a deal's name. Names live apart from the deal's
 *  numbers, owner-only like quotes, since a name can hold anything. */
async function saveDealName(supabase: Awaited<ReturnType<typeof currentUser>>['supabase'], userId: string, dealId: string, name: string) {
  if (name) await supabase.from('deal_labels').upsert({ deal_id: dealId, user_id: userId, name });
  else await supabase.from('deal_labels').delete().eq('deal_id', dealId).eq('user_id', userId);
}

type Db = Awaited<ReturnType<typeof currentUser>>['supabase'];

/**
 * The account id to store with a deal or quote: undefined to leave it as it
 * is, null for none, or the account's id (made here when it's new, with the
 * deal or quote it started from joined to it). Only the rep's own accounts
 * are used; anything else counts as none.
 */
async function resolveAccount(supabase: Db, userId: string, acct: AccountMeta | undefined): Promise<string | null | undefined> {
  if (acct === undefined) return undefined;
  if (acct === null) return null;
  const name = dealName(acct.name);
  if (acct.id && QUOTE_ID.test(acct.id)) {
    const patch: Record<string, unknown> = {};
    if (acct.name !== undefined) patch.name = name;
    if (acct.oneDecision !== undefined) patch.one_decision = acct.oneDecision;
    const q = Object.keys(patch).length
      ? supabase.from('deal_accounts').update(patch).eq('id', acct.id).eq('user_id', userId).select('id').maybeSingle()
      : supabase.from('deal_accounts').select('id').eq('id', acct.id).eq('user_id', userId).maybeSingle();
    const { data } = await q;
    return data ? String(data.id) : null;
  }
  // One name, one account: a name the rep already has joins that account
  // instead of making a second one.
  let id: string | null = null;
  if (name) {
    const { data: mine } = await supabase.from('deal_accounts').select('id, name').eq('user_id', userId);
    const same = (mine ?? []).find((a: { name: string }) => a.name.trim().toLowerCase() === name.toLowerCase());
    if (same) id = String(same.id);
  }
  if (!id) {
    const { data, error } = await supabase
      .from('deal_accounts')
      .insert({ user_id: userId, name, one_decision: acct.oneDecision !== false })
      .select('id')
      .single();
    if (error || !data) return null;
    id = String(data.id);
  }
  const from = acct.from;
  if (from && QUOTE_ID.test(from.id)) {
    await supabase
      .from(from.kind === 'deal' ? 'deals' : 'quotes')
      .update({ account_id: id })
      .eq('id', from.id)
      .eq('user_id', userId);
  }
  return id;
}

export async function saveDealAction(input: DealInput, meta?: BookMeta): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save deals.' };
  // Caught inside priceForBooking rather than left to throw: this runs from
  // a client button click, not a page load, so there's no error.tsx
  // boundary above it, and an uncaught rejection would leave the button
  // stuck "Saving…" instead of surfacing through the form's msg.error UI.
  const priced = await priceForBooking(user.id, input, meta);
  if ('error' in priced) return { error: priced.error };
  const { deal, r, createdAt, name } = priced;
  const accountId = await resolveAccount(supabase, user.id, meta?.account);

  const { data, error } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      ...dealColumns(deal, r),
      ...(createdAt ? { created_at: createdAt } : {}),
      ...(accountId !== undefined ? { account_id: accountId } : {}),
      ...(meta?.kind === 'upsell' ? { kind: 'upsell' } : {}),
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  // The deal is booked either way; a name that didn't save isn't worth failing it.
  if (name && data?.id) {
    try {
      await saveDealName(supabase, user.id, String(data.id), name);
    } catch {}
  }
  revalidatePath('/', 'layout');
  return {};
}

/** Changes a booked deal: its lines, name or booked day, repriced as if
 *  it had been booked that way. */
export async function updateDealAction(id: string, input: DealInput, meta?: BookMeta): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user || !QUOTE_ID.test(String(id))) return { error: 'Sign in to change deals.' };
  const priced = await priceForBooking(user.id, input, meta, id);
  if ('error' in priced) return { error: priced.error };
  const { deal, r, createdAt, name } = priced;
  const accountId = await resolveAccount(supabase, user.id, meta?.account);
  const { error } = await supabase
    .from('deals')
    .update({
      ...dealColumns(deal, r),
      ...(createdAt ? { created_at: createdAt } : {}),
      ...(accountId !== undefined ? { account_id: accountId } : {}),
    })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  try {
    await saveDealName(supabase, user.id, id, name);
  } catch {}
  revalidatePath('/', 'layout');
  return {};
}

export async function deleteDealAction(id: string): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user || !id) return { error: 'Sign in to delete deals.' };
  const { error } = await supabase.from('deals').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return {};
}

export async function savePlanAction(input: CompPlan): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save your plan.' };

  const n = (v: unknown, lo = 0) => (Number.isFinite(Number(v)) ? Math.max(lo, Number(v)) : NaN);

  // Optional and independent of accelerator_style — most plans send null
  // here. When present, target and each tier's attainment must be real
  // numbers greater than zero; kickerPct is clamped like every other rate
  // rather than rejected, same reasoning as base_rate above. A tier with an
  // amount pays that fixed bonus instead, and the amount has to be real.
  // The stretch tier is optional: many plans have a single bonus level.
  let quarterly_kicker: CompPlan['quarterly_kicker'] = null;
  if (input.quarterly_kicker) {
    const target = n(input.quarterly_kicker.target);
    const [t0, t1] = input.quarterly_kicker.tiers ?? [];
    const tierOf = (t: QuarterlyKickerTier): QuarterlyKickerTier =>
      typeof t.amount === 'number'
        ? { attainmentPct: n(t.attainmentPct), kickerPct: 0, amount: n(t.amount) }
        : { attainmentPct: n(t.attainmentPct), kickerPct: clampPct(Number(t.kickerPct)) };
    const tier0 = tierOf(t0 ?? { attainmentPct: NaN, kickerPct: 0 });
    const tier1 = t1 ? tierOf(t1) : null;
    if (!(target > 0) || !(tier0.attainmentPct > 0) || (tier1 && !(tier1.attainmentPct > 0))) {
      return { error: 'Quarterly Bonus target and attainment must be greater than zero.' };
    }
    if ([tier0, tier1].some((t) => t && t.amount !== undefined && !(t.amount > 0))) {
      return { error: 'Set what the Quarterly Bonus pays.' };
    }
    // kickerTierAt/quarterlyKickerSummary (calc.ts) sort tiers by
    // attainmentPct rather than trust array position — so a Stretch tier at
    // or below the base tier wouldn't crash, it would just silently become
    // "Tier 1" everywhere the plan is actually used, contradicting its own
    // label on this form. Reject it here instead of letting that drift.
    if (tier1 && !(tier1.attainmentPct > tier0.attainmentPct)) {
      return { error: 'Quarterly Bonus (Stretch) attainment must be higher than the base tier’s.' };
    }
    quarterly_kicker = { target, tiers: tier1 ? [tier0, tier1] : [tier0] };
  }

  const plan: CompPlan = {
    role_name: String(input.role_name ?? '').trim(),
    period: input.period === 'month' ? 'month' : 'quarter',
    quota_basis: input.quota_basis === 'units' ? 'units' : 'arr',
    quota: n(input.quota),
    commission_style: input.commission_style === 'percent' ? 'percent' : 'months_of_mrr',
    // Rates are always 0-100 regardless of commission_style — a percent
    // rate obviously can't exceed 100% of deal value, and a months-of-MRR
    // rate past 100 (8+ years of commission on one deal) is never a real
    // plan, only a typo. Same ceiling as one_time_weight below.
    base_rate: clampPct(Number(input.base_rate)),
    accelerator_style:
      input.accelerator_style === 'rate_switch' || input.accelerator_style === 'retro_bump'
        ? input.accelerator_style
        : 'none',
    // Threshold shares quota's basis ($ or units) and can legitimately be
    // large, so it's floored at 0 but not capped.
    accelerator_threshold: n(input.accelerator_threshold),
    accelerator_rate: clampPct(Number(input.accelerator_rate)),
    one_time_weight: clampPct(Number(input.one_time_weight)),
    // v14: hardware's own flat rate, or null when hardware counts with the rest of one-time.
    hardware_rate: typeof input.hardware_rate === 'number' ? clampPct(input.hardware_rate) : null,
    quarterly_kicker,
    // Both optional benchmarking fields — never required to save a plan.
    industry: String(input.industry ?? '').trim() || null,
    company_size_band: null,
  };
  // Validated against the fixed list rather than accepted as free text —
  // this is the value a future cohort view groups by, so a typo'd band
  // would silently start its own one-plan cohort instead of joining the
  // right one.
  const rawBand = String(input.company_size_band ?? '').trim();
  if (rawBand) {
    if (!COMPANY_SIZE_BANDS.some(([value]) => value === rawBand)) {
      return { error: 'Company size must be one of the listed bands.' };
    }
    plan.company_size_band = rawBand;
  }
  if (!plan.role_name) return { error: 'Role name is required.' };
  if (!(plan.quota > 0)) return { error: 'Quota must be greater than zero.' };
  if (!Number.isFinite(plan.accelerator_threshold)) return { error: 'Accelerator threshold must be a number.' };
  // A threshold of 0 with an accelerator style selected means "already
  // accelerated from the first deal" — permanently, since creditBooked can
  // never be negative (calc.ts). Not a crash, just a plan that can never
  // demonstrate the thing it's configured to do; most likely to happen
  // after switching quota_basis, which resets this field to 0 without
  // resetting accelerator_style.
  if (plan.accelerator_style !== 'none' && !(plan.accelerator_threshold > 0)) {
    return { error: 'Set a threshold for your accelerator. It can’t kick in at zero.' };
  }
  // Further accelerator steps (v13): same style as the first, each starting
  // past the one before it, rates clamped like the first's. Up to three.
  let accelerator_steps: AcceleratorStep[] | null = null;
  if (plan.accelerator_style !== 'none' && Array.isArray(input.accelerator_steps) && input.accelerator_steps.length > 0) {
    const steps = input.accelerator_steps.slice(0, 3).map((st) => ({ threshold: n(st?.threshold), rate: clampPct(Number(st?.rate)) }));
    let last = plan.accelerator_threshold;
    for (const st of steps) {
      if (!(st.threshold > last)) return { error: 'Each accelerator step has to start past the one before it.' };
      last = st.threshold;
    }
    accelerator_steps = steps;
  }

  // A starting point counts in the plan's own measure. If that changed (units
  // to ARR, a month to a quarter), the old one means nothing, so it goes.
  let previous: CompPlan | null = null;
  try {
    previous = await getCompPlan(user.id);
  } catch {}
  const measureChanged =
    previous !== null && (previous.quota_basis !== plan.quota_basis || previous.period !== plan.period);

  const { error } = await supabase
    .from('comp_plans')
    .upsert({ user_id: user.id, ...plan, accelerator_steps, ...(measureChanged ? { opening: null } : {}) }, { onConflict: 'user_id' });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return {};
}

/**
 * Saves where the rep already stands this period: what they'd booked before
 * IOI (calc.ts Opening), stamped with this period and quarter in their own
 * time zone. Lives on their working plan, never with plan records.
 */
export async function saveOpeningAction(input: OpeningInput): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save where you stand.' };
  let plan: CompPlan | null;
  try {
    plan = await getCompPlan(user.id);
  } catch {
    return { error: 'Could not load your comp plan. Try again in a moment.' };
  }
  if (!plan) return { error: 'Set up your comp plan first.' };

  const credit = Number(input.credit);
  const quarterArr = input.quarterArr === null || input.quarterArr === undefined ? null : Number(input.quarterArr);
  if (!(credit >= 0) || (quarterArr !== null && !(quarterArr >= 0))) {
    return { error: 'Enter amounts of zero or more.' };
  }
  const tz = await repTimeZone();
  const periodKey = periodKeyInZone(plan.period, tz);
  const saved = await getOpening(user.id);
  const opening: Opening = {
    periodKey,
    credit: plan.quota_basis === 'units' ? Math.round(credit) : Math.round(credit * 100) / 100,
    quarterKey: periodKeyInZone('quarter', tz),
    quarterArr: needsQuarterArr(plan) && quarterArr !== null ? Math.round(quarterArr * 100) / 100 : null,
    // Answered, even with nothing to add.
    entered: true,
    // This period's rate adjustment stays as it was.
    rateAdjust: saved?.periodKey === periodKey ? (saved.rateAdjust ?? null) : null,
  };
  const { error } = await supabase.from('comp_plans').update({ opening }).eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

/**
 * The rate on the rep's latest commission statement, for this period only:
 * stored as the points it sits above or below the plan's base rate (calc.ts
 * planForPeriod), so the accelerated rate moves with it. Null puts it back to
 * the plan's own rate.
 */
export async function saveRateAction(rate: number | null): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to set your rate.' };
  let plan: CompPlan | null;
  try {
    plan = await getCompPlan(user.id);
  } catch {
    return { error: 'Could not load your comp plan. Try again in a moment.' };
  }
  if (!plan) return { error: 'Set up your comp plan first.' };
  if (plan.commission_style !== 'percent') return { error: 'Your plan pays in months of MRR, so there’s no rate to set.' };
  if (rate !== null && !(Number.isFinite(rate) && rate > 0 && rate <= 100)) return { error: 'Enter a rate between 0% and 100%.' };

  const tz = await repTimeZone();
  const periodKey = periodKeyInZone(plan.period, tz);
  const saved = await getOpening(user.id);
  const current = saved?.periodKey === periodKey ? saved : null;
  const rateAdjust = rate === null ? null : Math.round((rate - plan.base_rate) * 1000) / 1000;
  const opening: Opening = current
    ? { ...current, rateAdjust: rateAdjust || null }
    : { periodKey, credit: 0, quarterKey: periodKeyInZone('quarter', tz), quarterArr: null, entered: false, rateAdjust: rateAdjust || null };
  const { error } = await supabase.from('comp_plans').update({ opening }).eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

/** Sets (or, with null, clears) the rep's own discount target for one line. */
/**
 * What the rep sells and the company's discount limits (v22), set with the
 * plan: whether Equipment is its own one-time line, and the most off each
 * line allows (absent: no limit; 0: no discount at all).
 */
export async function savePlanSetupAction(input: { sellsEquipment: boolean; limits: Record<string, unknown> }): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to change your plan.' };
  const limits: Record<string, number> = {};
  for (const line of LINES) {
    const n = input?.limits?.[line];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100) limits[line] = Math.round(n * 10) / 10;
  }
  const { error } = await supabase
    .from('comp_plans')
    .update({ sells_equipment: input?.sellsEquipment === true, limits })
    .eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

export async function saveTargetAction(line: Line, pct: number | null): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to set a target.' };
  if (!LINES.includes(line)) return { error: 'That isn’t a line on a deal.' };
  if (pct !== null && !(Number.isFinite(pct) && pct >= 0 && pct <= 100)) return { error: 'Pick a target between 0% and 100%.' };
  const targets = await getTargets(user.id);
  if (pct === null) delete targets[line];
  else targets[line] = Math.round(pct * 10) / 10;
  const { error } = await supabase.from('comp_plans').update({ targets }).eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

const QUOTE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const quoteName = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const quoteRow = (name: unknown, deal: DealInput) => ({
  name: quoteName(name),
  one_time_amount: deal.oneTime,
  subscription_amount: deal.subscription,
  subscription_mode: deal.subMode,
  units: deal.units,
  one_time_discount_pct: deal.oneTimeDiscountPct,
  subscription_discount_pct: deal.subscriptionDiscountPct,
  hardware_amount: deal.hardware ?? 0,
  hardware_discount_pct: deal.hardwareDiscountPct ?? 0,
});

/**
 * Saves a deal the rep is still working as an open quote: a new one, or the
 * one they reopened (`id`). Returns its id so the page can keep it open.
 */
export async function saveQuoteAction(input: {
  id?: string | null;
  name: string;
  deal: DealInput;
  account?: AccountMeta;
}): Promise<Result & { id?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save quotes.' };
  const deal = cleanDeal(input.deal);
  if (isBlank(deal)) return { error: 'Enter at least one line item before saving.' };
  const accountId = await resolveAccount(supabase, user.id, input.account);
  const row = { ...quoteRow(input.name, deal), ...(accountId !== undefined ? { account_id: accountId } : {}) };
  // Numbers changed by hand become the quote; any sign-by offer on it ends.
  const offerOff = { offer_expires: null, offer_revert: null };
  if (input.id && QUOTE_ID.test(input.id)) {
    const { data, error } = await supabase
      .from('quotes')
      .update({ ...row, ...offerOff, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (error) return { error: 'That didn’t save. Try again in a moment.' };
    if (data) {
      revalidatePath('/', 'layout');
      return { id: String(data.id) };
    }
  }
  const { data, error } = await supabase.from('quotes').insert({ user_id: user.id, ...row }).select('id').single();
  if (error || !data) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return { id: String(data.id) };
}

/**
 * Takes a booked deal back out of the period: it goes back in the pipeline
 * as an open quote, with its name and numbers, and leaves the closed deals.
 * The quote is written first, so a failure part way never loses the deal;
 * if the deal can't be removed, the new quote is taken back out.
 */
export async function unbookDealAction(id: string): Promise<Result & { id?: string }> {
  const { supabase, user } = await currentUser();
  if (!user || !QUOTE_ID.test(String(id))) return { error: 'Sign in to change deals.' };
  const [{ data: row, error: readError }, { data: label }] = await Promise.all([
    supabase
      .from('deals')
      .select('one_time_amount, subscription_amount, subscription_mode, units, one_time_discount_pct, subscription_discount_pct, hardware_amount, hardware_discount_pct, account_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('deal_labels').select('name').eq('deal_id', id).eq('user_id', user.id).maybeSingle(),
  ]);
  if (readError || !row) return { error: 'That deal is already gone. Refresh the page.' };
  const deal = cleanDeal({
    oneTime: Number(row.one_time_amount),
    subscription: Number(row.subscription_amount),
    subMode: row.subscription_mode,
    units: Math.max(1, Number(row.units)),
    oneTimeDiscountPct: Number(row.one_time_discount_pct),
    subscriptionDiscountPct: Number(row.subscription_discount_pct),
    hardware: Number(row.hardware_amount ?? 0),
    hardwareDiscountPct: Number(row.hardware_discount_pct ?? 0),
  });
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({ user_id: user.id, ...quoteRow(label?.name ?? '', deal), account_id: row.account_id ?? null })
    .select('id')
    .single();
  if (quoteError || !quote) return { error: 'That didn’t go through. Try again in a moment.' };
  const { error } = await supabase.from('deals').delete().eq('id', id).eq('user_id', user.id);
  if (error) {
    await supabase.from('quotes').delete().eq('id', quote.id).eq('user_id', user.id);
    return { error: 'That didn’t go through. Try again in a moment.' };
  }
  revalidatePath('/', 'layout');
  return { id: String(quote.id) };
}

/** The rep's call on open quotes (all of an account's at once, when it
 *  decides as one), or null to clear it. */
export async function setForecastAction(ids: string[], forecast: Forecast | null): Promise<Result> {
  const { supabase, user } = await currentUser();
  const clean = (Array.isArray(ids) ? ids : []).filter((id) => QUOTE_ID.test(String(id))).slice(0, 50);
  if (!user || !clean.length) return { error: 'Sign in to change quotes.' };
  if (forecast !== null && !FORECASTS.includes(forecast)) return { error: 'That isn’t a call IOI knows.' };
  const { error } = await supabase.from('quotes').update({ forecast }).in('id', clean).eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

/**
 * Puts a saved quote or booked deal in an account (an existing one, or one
 * made now; a name the rep already has joins that account), or takes it out
 * with `null`. Saves at once: an account is a fact about the buyer, not an
 * edit to the deal's numbers.
 */
export async function assignAccountAction(
  target: { kind: 'quote' | 'deal'; id: string },
  account: AccountMeta,
): Promise<Result & { accountId?: string | null }> {
  const { supabase, user } = await currentUser();
  if (!user || !target || !QUOTE_ID.test(String(target.id))) return { error: 'Sign in to change accounts.' };
  const accountId = await resolveAccount(supabase, user.id, account === null ? null : { ...account, from: null });
  if (account !== null && !accountId) return { error: 'That didn’t save. Try again in a moment.' };
  const { error } = await supabase
    .from(target.kind === 'deal' ? 'deals' : 'quotes')
    .update({ account_id: accountId ?? null })
    .eq('id', target.id)
    .eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return { accountId: accountId ?? null };
}

/** Renames an account, or changes whether its deals close as one. */
export async function updateAccountAction(id: string, patch: { name?: string; oneDecision?: boolean }): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user || !QUOTE_ID.test(String(id))) return { error: 'Sign in to change accounts.' };
  const res = await resolveAccount(supabase, user.id, { id, ...patch });
  if (!res) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

/**
 * Closed lost: the quotes leave the open list but are kept, with the day
 * and (if the rep gave one) the reason, so a win rate can be worked out
 * later. Removing a quote (deleteQuoteAction) is for ones that were never
 * real and counts nowhere.
 */
export async function loseQuotesAction(ids: string[], reason: LostReason | null): Promise<Result> {
  const { supabase, user } = await currentUser();
  const clean = (Array.isArray(ids) ? ids : []).filter((id) => QUOTE_ID.test(String(id))).slice(0, 50);
  if (!user || !clean.length) return { error: 'Sign in to change quotes.' };
  const why = reason && LOST_REASONS.some((r) => r.key === reason) ? reason : null;
  const { error } = await supabase
    .from('quotes')
    .update({ status: 'lost', closed_at: new Date().toISOString(), lost_reason: why, forecast: null })
    .in('id', clean)
    .eq('user_id', user.id);
  if (error) return { error: 'That didn’t go through. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

const quoteDeal = (q: Record<string, unknown>): DealInput =>
  cleanDeal({
    oneTime: Number(q.one_time_amount),
    subscription: Number(q.subscription_amount),
    subMode: q.subscription_mode === 'acv' ? 'acv' : 'mrr',
    units: Math.max(1, Number(q.units)),
    oneTimeDiscountPct: Number(q.one_time_discount_pct),
    subscriptionDiscountPct: Number(q.subscription_discount_pct),
    hardware: Number(q.hardware_amount ?? 0),
    hardwareDiscountPct: Number(q.hardware_discount_pct ?? 0),
  });

/**
 * A sign-by offer: the quote takes the offer's numbers until `expires`
 * ('YYYY-MM-DD', the last day it holds), and keeps the numbers it had so it
 * can go back. A second offer on the same quote keeps the first original.
 */
export async function makeOfferAction(id: string, offered: DealInput, expires: string): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user || !QUOTE_ID.test(String(id)) || !DAY.test(String(expires))) return { error: 'Sign in to change quotes.' };
  const { data: q } = await supabase.from('quotes').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!q) return { error: 'That quote is already gone. Refresh the page.' };
  const original = q.offer_revert ?? quoteDeal(q);
  const deal = cleanDeal(offered);
  const { error } = await supabase
    .from('quotes')
    .update({ ...quoteRow(q.name, deal), offer_expires: expires, offer_revert: original, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

/** Takes a sign-by offer back: the quote returns to its own numbers. */
export async function withdrawOfferAction(id: string): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user || !QUOTE_ID.test(String(id))) return { error: 'Sign in to change quotes.' };
  const { data: q } = await supabase.from('quotes').select('name, offer_revert').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!q) return { error: 'That quote is already gone. Refresh the page.' };
  if (!q.offer_revert) return {};
  const { error } = await supabase
    .from('quotes')
    .update({ ...quoteRow(q.name, cleanDeal(q.offer_revert as DealInput)), offer_expires: null, offer_revert: null })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: 'That didn’t save. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

/**
 * Open quotes whose sign-by offer ran out (its last day is before `today`,
 * the rep's own 'YYYY-MM-DD') go back to their own numbers. Run as the home
 * page loads, so an offer never outlives its date.
 */
export async function revertExpiredOffers(today: string): Promise<void> {
  if (!DAY.test(String(today))) return;
  try {
    const { supabase, user } = await currentUser();
    if (!user) return;
    const { data } = await supabase
      .from('quotes')
      .select('id, name, offer_revert')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .lt('offer_expires', today);
    for (const q of data ?? []) {
      if (!q.offer_revert) continue;
      await supabase
        .from('quotes')
        .update({ ...quoteRow(q.name, cleanDeal(q.offer_revert as DealInput)), offer_expires: null, offer_revert: null })
        .eq('id', q.id)
        .eq('user_id', user.id);
    }
  } catch {}
}

export async function deleteQuoteAction(id: string): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user || !QUOTE_ID.test(String(id))) return { error: 'Sign in to remove quotes.' };
  const { error } = await supabase.from('quotes').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { error: 'That didn’t go through. Try again in a moment.' };
  revalidatePath('/', 'layout');
  return {};
}

const VISITOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes the signed-in account and everything saved with it: the working
 * plan and deals (they cascade from the account), every plan it shared, and
 * any plans this browser shared before signing in. Needs the server key,
 * since only the server may remove an account.
 */
export async function deleteAccountAction(visitorId: string): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to delete your account.' };
  const db = serviceClient();
  if (!db) return { error: 'Deleting accounts isn’t available right now. Email privacy@tryioi.com and it’ll be done within 30 days.' };
  if (VISITOR.test(visitorId)) await db.from('plan_records').delete().eq('visitor_id', visitorId);
  await db.from('plan_records').delete().eq('user_id', user.id);
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return { error: 'That didn’t go through. Try again, or email privacy@tryioi.com.' };
  try {
    await supabase.auth.signOut();
  } catch {}
  revalidatePath('/', 'layout');
  return {};
}

