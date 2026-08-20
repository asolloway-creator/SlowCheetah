'use server';

import { revalidatePath } from 'next/cache';
import { getCompPlan, getMonthToDate, requireUser } from '@/lib/queries';
import { calc, type DealInput, type SubscriptionMode } from '@/lib/calc';

export type SaveState = { error: string | null; savedId: string | null };

const clampPct = (n: number) => Math.min(100, Math.max(0, n));
const money = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

function readDeal(fd: FormData): DealInput {
  const mode = String(fd.get('subMode') ?? 'mrr');
  return {
    oneTime: money(Number(fd.get('oneTime'))),
    implementation: money(Number(fd.get('implementation'))),
    subscription: money(Number(fd.get('subscription'))),
    subMode: (mode === 'acv' ? 'acv' : 'mrr') as SubscriptionMode,
    units: Math.max(1, Math.round(Number(fd.get('units')) || 1)),
    oneTimeDiscountPct: clampPct(Number(fd.get('oneTimeDiscountPct')) || 0),
    implementationDiscountPct: clampPct(Number(fd.get('implementationDiscountPct')) || 0),
    subscriptionDiscountPct: clampPct(Number(fd.get('subscriptionDiscountPct')) || 0),
  };
}

export async function saveDeal(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const { supabase, user } = await requireUser();

  const plan = await getCompPlan();
  if (!plan) return { error: 'Set up your comp plan before saving a deal.', savedId: null };

  const deal = readDeal(formData);
  if (deal.oneTime === 0 && deal.implementation === 0 && deal.subscription === 0)
    return { error: 'Enter at least one line item before saving.', savedId: null };

  // Recompute server-side against live month-to-date rather than trusting the
  // numbers the browser posted. The stored commission is a snapshot: it reflects
  // the rate that applied when the deal was booked.
  const mtd = await getMonthToDate();
  const result = calc(plan, deal, mtd);

  const { data, error } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      one_time_amount: deal.oneTime,
      implementation_amount: deal.implementation,
      subscription_amount: deal.subscription,
      subscription_mode: deal.subMode,
      units: deal.units,
      one_time_discount_pct: deal.oneTimeDiscountPct,
      implementation_discount_pct: deal.implementationDiscountPct,
      subscription_discount_pct: deal.subscriptionDiscountPct,
      commission_earned: Number(result.commission.toFixed(2)),
      money_left_on_table: Number(result.lost.toFixed(2)),
    })
    .select('id')
    .single();

  if (error) return { error: error.message, savedId: null };

  revalidatePath('/', 'layout');
  return { error: null, savedId: data.id };
}

export async function deleteDeal(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await supabase.from('deals').delete().eq('id', id).eq('user_id', user.id);
  revalidatePath('/', 'layout');
}
