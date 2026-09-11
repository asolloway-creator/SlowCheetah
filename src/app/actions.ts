'use server';

import { revalidatePath } from 'next/cache';
import { currentUser, getCompPlan, getPeriodToDate } from '@/lib/queries';
import { calc, type CompPlan, type DealInput } from '@/lib/calc';

export type Result = { error?: string };

const clampPct = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
const money = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

export async function saveDealAction(input: DealInput): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save deals.' };
  const plan = await getCompPlan(user.id);
  if (!plan) return { error: 'Set up your comp plan before saving a deal.' };

  const deal: DealInput = {
    oneTime: money(input.oneTime),
    subscription: money(input.subscription),
    subMode: input.subMode === 'acv' ? 'acv' : 'mrr',
    units: Math.max(1, Math.round(Number(input.units) || 1)),
    oneTimeDiscountPct: clampPct(input.oneTimeDiscountPct),
    subscriptionDiscountPct: clampPct(input.subscriptionDiscountPct),
  };
  if (deal.oneTime === 0 && deal.subscription === 0)
    return { error: 'Enter at least one line item before saving.' };

  // Recompute against the live period rather than trusting the browser.
  const ptd = await getPeriodToDate(user.id, plan);
  const r = calc(plan, deal, ptd);

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
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return {};
}

export async function deleteDealAction(id: string): Promise<void> {
  const { supabase, user } = await currentUser();
  if (!user || !id) return;
  await supabase.from('deals').delete().eq('id', id).eq('user_id', user.id);
  revalidatePath('/', 'layout');
}

export async function savePlanAction(input: CompPlan): Promise<Result> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Sign in to save your plan.' };

  const n = (v: unknown, lo = 0) => (Number.isFinite(Number(v)) ? Math.max(lo, Number(v)) : NaN);
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
  };
  if (!plan.role_name) return { error: 'Role name is required.' };
  if (!(plan.quota > 0)) return { error: 'Quota must be greater than zero.' };
  if (!Number.isFinite(plan.accelerator_threshold)) return { error: 'Accelerator threshold must be a number.' };

  const { error } = await supabase
    .from('comp_plans')
    .upsert({ user_id: user.id, ...plan }, { onConflict: 'user_id' });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return {};
}

/**
 * Carries a plan the visitor shaped in the demo (browser localStorage) over
 * into their real account on first sign-in. Same validation and upsert as
 * `savePlanAction` — this only exists separately so the demo-import banner
 * can call something purpose-named rather than reusing a form-submit action.
 */
export async function importDemoPlanAction(input: CompPlan): Promise<Result> {
  return savePlanAction(input);
}
