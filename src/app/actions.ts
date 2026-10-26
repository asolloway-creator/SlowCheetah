'use server';

import { revalidatePath } from 'next/cache';
import { currentUser, getCompPlan, getOpening, getPeriodToDate, repTimeZone } from '@/lib/queries';
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

/** What the rep adds when booking: the deal's name and the day it was booked. */
export type BookMeta = { name?: string; bookedOn?: string };

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

  const { data, error } = await supabase
    .from('deals')
    .insert({ user_id: user.id, ...dealColumns(deal, r), ...(createdAt ? { created_at: createdAt } : {}) })
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
  const { error } = await supabase
    .from('deals')
    .update({ ...dealColumns(deal, r), ...(createdAt ? { created_at: createdAt } : {}) })
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
}): Promise<Result & { id?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save quotes.' };
  const deal = cleanDeal(input.deal);
  if (isBlank(deal)) return { error: 'Enter at least one line item before saving.' };
  const row = quoteRow(input.name, deal);
  if (input.id && QUOTE_ID.test(input.id)) {
    const { data, error } = await supabase
      .from('quotes')
      .update({ ...row, updated_at: new Date().toISOString() })
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

