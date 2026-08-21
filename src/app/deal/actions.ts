'use server';

import { revalidatePath } from 'next/cache';
import { getCompPlan, getQuarterToDate, requireUser } from '@/lib/queries';
import { calc, type DealInput, type OnboardingPackage } from '@/lib/calc';

export type SaveState = { error: string | null; savedId: string | null };

const clampPct = (n: number) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
const count = (n: number, min = 0) => Math.max(min, Math.round(Number.isFinite(n) ? n : min));

function readDeal(fd: FormData): DealInput {
  const pkgRaw = String(fd.get('pkg') ?? 'boost');
  const pkg: OnboardingPackage =
    pkgRaw === 'launch' || pkgRaw === 'accelerate' ? pkgRaw : 'boost';
  return {
    locations: count(Number(fd.get('locations')), 1),
    freepour: fd.get('freepour') === 'true',
    pkg,
    saasDiscountPct: clampPct(Number(fd.get('saasDiscountPct'))),
    sideDishes: {
      recipes: count(Number(fd.get('recipes'))),
      qbo: fd.get('qbo') === 'true',
      commissary: fd.get('commissary') === 'true',
      invoiceBackMonths: count(Number(fd.get('invoiceBackMonths'))),
    },
  };
}

export async function saveDeal(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const { supabase, user } = await requireUser();

  const plan = await getCompPlan();
  if (!plan) return { error: 'Set up your comp plan before saving a deal.', savedId: null };

  const deal = readDeal(formData);

  // Recompute server-side against the live quarter rather than trusting the
  // browser. commission_base is stored PRE-accelerator: the retroactive 25%
  // is applied at the quarter level when displaying payouts.
  const qtd = await getQuarterToDate();
  const r = calc(plan, deal, qtd);

  const { data, error } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      locations: deal.locations,
      freepour: deal.freepour,
      onboarding_package: deal.pkg,
      saas_discount_pct: deal.saasDiscountPct,
      recipes: deal.sideDishes.recipes,
      qbo: deal.sideDishes.qbo,
      commissary: deal.sideDishes.commissary,
      invoice_back_months: deal.sideDishes.invoiceBackMonths,
      mrr: Number(r.mrr.toFixed(2)),
      arr: Number(r.arr.toFixed(2)),
      commission_base: Number(r.commissionBase.toFixed(2)),
      bonus_amount: Number(r.bonus.toFixed(2)),
      one_time_revenue: Number(r.oneTimeRevenue.toFixed(2)),
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
