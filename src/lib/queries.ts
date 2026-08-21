import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  startOfQuarter,
  type CompPlan,
  type OnboardingPackage,
  type QuarterToDate,
} from '@/lib/calc';

export type DealRow = {
  id: string;
  locations: number;
  freepour: boolean;
  onboarding_package: OnboardingPackage;
  saas_discount_pct: number;
  recipes: number;
  qbo: boolean;
  commissary: boolean;
  invoice_back_months: number;
  mrr: number;
  arr: number;
  commission_base: number;
  bonus_amount: number;
  one_time_revenue: number;
  created_at: string;
};

/** The signed-in user, or a redirect to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function getCompPlan(): Promise<CompPlan | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('comp_plans')
    .select(
      'role_name, quarterly_arr_quota, commission_months, accelerator_pct, accelerator_on_bonuses, software_mrr, freepour_mrr, bonus_launch, bonus_boost, bonus_accelerate',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    role_name: data.role_name,
    quarterly_arr_quota: Number(data.quarterly_arr_quota),
    commission_months: Number(data.commission_months),
    accelerator_pct: Number(data.accelerator_pct),
    accelerator_on_bonuses: Boolean(data.accelerator_on_bonuses),
    software_mrr: Number(data.software_mrr),
    freepour_mrr: Number(data.freepour_mrr),
    bonus_launch: Number(data.bonus_launch),
    bonus_boost: Number(data.bonus_boost),
    bonus_accelerate: Number(data.bonus_accelerate),
  };
}

function toDealRow(d: Record<string, unknown>): DealRow {
  return {
    id: String(d.id),
    locations: Number(d.locations),
    freepour: Boolean(d.freepour),
    onboarding_package: d.onboarding_package as OnboardingPackage,
    saas_discount_pct: Number(d.saas_discount_pct),
    recipes: Number(d.recipes),
    qbo: Boolean(d.qbo),
    commissary: Boolean(d.commissary),
    invoice_back_months: Number(d.invoice_back_months),
    mrr: Number(d.mrr),
    arr: Number(d.arr),
    commission_base: Number(d.commission_base),
    bonus_amount: Number(d.bonus_amount),
    one_time_revenue: Number(d.one_time_revenue),
    created_at: String(d.created_at),
  };
}

export async function listDeals(opts?: { since?: Date }): Promise<DealRow[]> {
  const { supabase, user } = await requireUser();
  let q = supabase
    .from('deals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (opts?.since) q = q.gte('created_at', opts.since.toISOString());

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDealRow);
}

/** Quarter-to-date position, rebuilt from saved deals. */
export async function getQuarterToDate(): Promise<QuarterToDate & { deals: DealRow[] }> {
  const deals = await listDeals({ since: startOfQuarter() });
  return {
    arrBooked: deals.reduce((s, d) => s + d.arr, 0),
    commissionBooked: deals.reduce((s, d) => s + d.commission_base, 0),
    bonusesBooked: deals.reduce((s, d) => s + d.bonus_amount, 0),
    deals,
  };
}
