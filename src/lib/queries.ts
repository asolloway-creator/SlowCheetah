import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { dealAnnualizedArr, type CompPlan, type MonthToDate, type SubscriptionMode } from '@/lib/calc';

export type DealRow = {
  id: string;
  one_time_amount: number;
  implementation_amount: number;
  subscription_amount: number;
  subscription_mode: SubscriptionMode;
  units: number;
  one_time_discount_pct: number;
  implementation_discount_pct: number;
  subscription_discount_pct: number;
  commission_earned: number;
  money_left_on_table: number;
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
      'role_name, monthly_unit_quota, base_rate, accelerator_threshold, accelerator_rate, monthly_arr_quota',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    role_name: data.role_name,
    monthly_unit_quota: Number(data.monthly_unit_quota),
    base_rate: Number(data.base_rate),
    accelerator_threshold: Number(data.accelerator_threshold),
    accelerator_rate: Number(data.accelerator_rate),
    monthly_arr_quota:
      data.monthly_arr_quota === null ? null : Number(data.monthly_arr_quota),
  };
}

function toDealRow(d: Record<string, unknown>): DealRow {
  return {
    id: String(d.id),
    one_time_amount: Number(d.one_time_amount),
    implementation_amount: Number(d.implementation_amount),
    subscription_amount: Number(d.subscription_amount),
    subscription_mode: d.subscription_mode as SubscriptionMode,
    units: Number(d.units),
    one_time_discount_pct: Number(d.one_time_discount_pct),
    implementation_discount_pct: Number(d.implementation_discount_pct),
    subscription_discount_pct: Number(d.subscription_discount_pct),
    commission_earned: Number(d.commission_earned),
    money_left_on_table: Number(d.money_left_on_table),
    created_at: String(d.created_at),
  };
}

/** First instant of the current calendar month, in the server's timezone. */
export function startOfThisMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
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

/**
 * Quota position for the current month, rebuilt from saved deals. This is what
 * replaces the prototype's manually typed "deals booked this month" field.
 */
export async function getMonthToDate(): Promise<MonthToDate & { deals: DealRow[] }> {
  const deals = await listDeals({ since: startOfThisMonth() });
  return {
    unitsBooked: deals.reduce((s, d) => s + d.units, 0),
    arrBooked: deals.reduce((s, d) => s + dealAnnualizedArr(d), 0),
    deals,
  };
}
