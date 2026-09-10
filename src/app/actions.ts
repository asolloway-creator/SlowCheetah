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
    implementation: money(input.implementation),
    subscription: money(input.subscription),
    subMode: input.subMode === 'acv' ? 'acv' : 'mrr',
    units: Math.max(1, Math.round(Number(input.units) || 1)),
    attach: Boolean(input.attach),
    oneTimeDiscountPct: clampPct(input.oneTimeDiscountPct),
    implementationDiscountPct: clampPct(input.implementationDiscountPct),
    subscriptionDiscountPct: clampPct(input.subscriptionDiscountPct),
  };
  if (deal.oneTime === 0 && deal.implementation === 0 && deal.subscription === 0)
    return { error: 'Enter at least one line item before saving.' };

  // Recompute against the live period rather than trusting the browser.
  const ptd = await getPeriodToDate(user.id, plan);
  const r = calc(plan, deal, ptd);

  const { error } = await supabase.from('deals').insert({
    user_id: user.id,
    one_time_amount: deal.oneTime,
    implementation_amount: deal.implementation,
    subscription_amount: deal.subscription,
    subscription_mode: deal.subMode,
    units: deal.units,
    attach: deal.attach,
    one_time_discount_pct: deal.oneTimeDiscountPct,
    implementation_discount_pct: deal.implementationDiscountPct,
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
    base_rate: n(input.base_rate),
    accelerator_style:
      input.accelerator_style === 'rate_switch' || input.accelerator_style === 'retro_bump'
        ? input.accelerator_style
        : 'none',
    accelerator_threshold: n(input.accelerator_threshold),
    accelerator_rate: n(input.accelerator_rate),
    one_time_weight: clampPct(Number(input.one_time_weight)),
    implementation_weight: clampPct(Number(input.implementation_weight)),
    attach_enabled: Boolean(input.attach_enabled),
    attach_name: String(input.attach_name ?? '').trim(),
    attach_mrr: n(input.attach_mrr),
  };
  if (!plan.role_name) return { error: 'Role name is required.' };
  if (!(plan.quota > 0)) return { error: 'Quota must be greater than zero.' };
  for (const k of ['base_rate', 'accelerator_threshold', 'accelerator_rate', 'attach_mrr'] as const) {
    if (!Number.isFinite(plan[k])) return { error: `${k.replaceAll('_', ' ')} must be a number.` };
  }

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
