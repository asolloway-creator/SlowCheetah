'use server';

import { revalidatePath } from 'next/cache';
import { currentUser, getCompPlan, getOpening, getPeriodToDate, repTimeZone } from '@/lib/queries';
import {
  calc,
  COMPANY_SIZE_BANDS,
  needsQuarterArr,
  periodKeyInZone,
  withPeriodOpening,
  type CompPlan,
  type DealInput,
  type Opening,
  type OpeningInput,
  type PeriodToDate,
  type Quote,
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
  };
}

export async function saveDealAction(input: DealInput): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save deals.' };
  // Caught here rather than left to throw: this runs from a client button
  // click, not a page load, so there's no error.tsx boundary above it to
  // catch a rejection — an uncaught one would leave the button stuck
  // "Saving…" forever instead of surfacing through the same msg.error UI
  // every other failure on this form already uses. Both reads need this,
  // not just the first — a transient failure on either one is the same
  // stuck-button failure mode from the caller's point of view.
  let plan: CompPlan | null;
  try {
    plan = await getCompPlan(user.id);
  } catch {
    return { error: 'Could not load your comp plan. Try again in a moment.' };
  }
  if (!plan) return { error: 'Set up your comp plan before saving a deal.' };
  const compPlan = plan;

  const deal = cleanDeal(input);
  if (deal.oneTime === 0 && deal.subscription === 0)
    return { error: 'Enter at least one line item before saving.' };

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
  const userId = user.id;
  async function readPtd() {
    try {
      return await getPeriodToDate(userId, compPlan);
    } catch {
      return null;
    }
  }
  let ptd = await readPtd();
  if (!ptd) return { error: 'Could not load where you stand this period. Try again in a moment.' };
  let r = calc(plan, deal, ptd);
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    const confirm = await readPtd();
    if (!confirm) return { error: 'Could not load where you stand this period. Try again in a moment.' };
    if (confirm.creditBooked === ptd.creditBooked) break;
    ptd = confirm;
    r = calc(plan, deal, ptd);
  }

  const { error } = await supabase.from('deals').insert({
    user_id: user.id,
    one_time_amount: deal.oneTime,
    subscription_amount: deal.subscription,
    subscription_mode: deal.subMode,
    units: deal.units,
    one_time_discount_pct: deal.oneTimeDiscountPct,
    subscription_discount_pct: deal.subscriptionDiscountPct,
    quota_credit: Number(r.credit.toFixed(2)),
    arr: Number(r.subAnnual.toFixed(2)),
    commission_base: Number(r.commissionBase.toFixed(2)),
    commission_earned: Number(r.commissionEffective.toFixed(2)),
    money_left_on_table: Number(r.lost.toFixed(2)),
    saas_commission: Number(r.saasCommissionEffective.toFixed(2)),
  });
  if (error) return { error: error.message };
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
  // rather than rejected, same reasoning as base_rate above. The stretch
  // tier is optional: many plans have a single bonus level.
  let quarterly_kicker: CompPlan['quarterly_kicker'] = null;
  if (input.quarterly_kicker) {
    const target = n(input.quarterly_kicker.target);
    const [t0, t1] = input.quarterly_kicker.tiers ?? [];
    const tier0 = { attainmentPct: n(t0?.attainmentPct), kickerPct: clampPct(Number(t0?.kickerPct)) };
    const tier1 = t1 ? { attainmentPct: n(t1.attainmentPct), kickerPct: clampPct(Number(t1.kickerPct)) } : null;
    if (!(target > 0) || !(tier0.attainmentPct > 0) || (tier1 && !(tier1.attainmentPct > 0))) {
      return { error: 'Quarterly kicker target and tier attainment must be greater than zero.' };
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
    .upsert({ user_id: user.id, ...plan, ...(measureChanged ? { opening: null } : {}) }, { onConflict: 'user_id' });
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
  const opening: Opening = {
    periodKey: periodKeyInZone(plan.period, tz),
    credit: plan.quota_basis === 'units' ? Math.round(credit) : Math.round(credit * 100) / 100,
    quarterKey: periodKeyInZone('quarter', tz),
    quarterArr: needsQuarterArr(plan) && quarterArr !== null ? Math.round(quarterArr * 100) / 100 : null,
  };
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
  if (deal.oneTime === 0 && deal.subscription === 0) return { error: 'Enter at least one line item before saving.' };
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

export type ImportedDeal = { deal: DealInput; createdAt: string };

/**
 * Carries what a visitor set up in the browser (lib/demo.ts) into their new
 * account on first sign-in: the plan, the starting point for this period when
 * they'd given one, and the deals they booked, kept on the days they booked
 * them. Each deal is re-run here, oldest first, against its own period (and
 * the starting point, in that period), rather than trusting the browser's
 * figures. Same validation as every other save.
 */
export async function importDemoPlanAction(
  input: CompPlan,
  opening?: OpeningInput | null,
  deals: ImportedDeal[] = [],
  quotes: Quote[] = [],
): Promise<Result> {
  const res = await savePlanAction(input);
  if (res.error) return res;
  if (opening) {
    const saved = await saveOpeningAction(opening);
    if (saved.error) return saved;
  }
  if (!deals.length && !quotes.length) return {};

  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save deals.' };
  let plan: CompPlan | null;
  try {
    plan = await getCompPlan(user.id);
  } catch {
    return { error: 'Your plan is in, but your deals didn’t come across. Try again in a moment.' };
  }
  if (!plan) return {};
  const tz = await repTimeZone();
  const start = await getOpening(user.id);
  const now = Date.now();
  const clean = deals
    .slice(0, 300)
    .map((d) => ({ deal: cleanDeal(d.deal), at: new Date(Math.min(now, Date.parse(d.createdAt) || now)) }))
    .filter((d) => d.deal.oneTime > 0 || d.deal.subscription > 0)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const byPeriod = new Map<string, PeriodToDate>();
  const rows = clean.map(({ deal, at }) => {
    const key = periodKeyInZone(plan.period, tz, at);
    const ptd = byPeriod.get(key) ?? withPeriodOpening(plan, { creditBooked: 0, commissionBooked: 0, earnedBooked: 0 }, start, key);
    const r = calc(plan, deal, ptd);
    byPeriod.set(key, {
      creditBooked: ptd.creditBooked + r.credit,
      commissionBooked: ptd.commissionBooked + r.commissionBase,
      earnedBooked: ptd.earnedBooked + r.commissionEffective,
    });
    return {
      user_id: user.id,
      one_time_amount: deal.oneTime,
      subscription_amount: deal.subscription,
      subscription_mode: deal.subMode,
      units: deal.units,
      one_time_discount_pct: deal.oneTimeDiscountPct,
      subscription_discount_pct: deal.subscriptionDiscountPct,
      quota_credit: Number(r.credit.toFixed(2)),
      arr: Number(r.subAnnual.toFixed(2)),
      commission_base: Number(r.commissionBase.toFixed(2)),
      commission_earned: Number(r.commissionEffective.toFixed(2)),
      money_left_on_table: Number(r.lost.toFixed(2)),
      saas_commission: Number(r.saasCommissionEffective.toFixed(2)),
      created_at: at.toISOString(),
    };
  });
  if (rows.length) {
    const { error } = await supabase.from('deals').insert(rows);
    if (error) return { error: 'Your plan is in, but your deals didn’t come across. Try again in a moment.' };
  }
  const quoteRows = quotes
    .slice(0, 50)
    .map((q) => ({ q, deal: cleanDeal(q.deal) }))
    .filter(({ deal }) => deal.oneTime > 0 || deal.subscription > 0)
    .map(({ q, deal }) => ({
      user_id: user.id,
      ...quoteRow(q.name, deal),
      created_at: new Date(Math.min(now, Date.parse(q.createdAt) || now)).toISOString(),
      updated_at: new Date(Math.min(now, Date.parse(q.updatedAt) || now)).toISOString(),
    }));
  if (quoteRows.length) {
    const { error } = await supabase.from('quotes').insert(quoteRows);
    if (error) return { error: 'Your plan and deals are in, but your quotes didn’t come across. Try again in a moment.' };
  }
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

