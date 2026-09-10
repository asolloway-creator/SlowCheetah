import { createClient } from '@/lib/supabase/server';
import {
  periodToDateFrom,
  startOfPeriod,
  type CompPlan,
  type PeriodToDate,
  type SubscriptionMode,
} from '@/lib/calc';

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
  quota_credit: number;
  arr: number;
  commission_base: number;
  commission_earned: number;
  money_left_on_table: number;
  created_at: string;
};

/** The signed-in user, or null — pages fall back to demo mode when null. */
export async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const num = (v: unknown) => Number(v);

export async function getCompPlan(userId: string): Promise<CompPlan | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('comp_plans').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  return {
    role_name: String(data.role_name),
    period: data.period,
    quota_basis: data.quota_basis,
    quota: num(data.quota),
    commission_style: data.commission_style,
    base_rate: num(data.base_rate),
    accelerator_style: data.accelerator_style,
    accelerator_threshold: num(data.accelerator_threshold),
    accelerator_rate: num(data.accelerator_rate),
    one_time_weight: num(data.one_time_weight),
    implementation_weight: num(data.implementation_weight),
  };
}

function toDealRow(d: Record<string, unknown>): DealRow {
  return {
    id: String(d.id),
    one_time_amount: num(d.one_time_amount),
    implementation_amount: num(d.implementation_amount),
    subscription_amount: num(d.subscription_amount),
    subscription_mode: d.subscription_mode as SubscriptionMode,
    units: num(d.units),
    one_time_discount_pct: num(d.one_time_discount_pct),
    implementation_discount_pct: num(d.implementation_discount_pct),
    subscription_discount_pct: num(d.subscription_discount_pct),
    quota_credit: num(d.quota_credit),
    arr: num(d.arr),
    commission_base: num(d.commission_base),
    commission_earned: num(d.commission_earned),
    money_left_on_table: num(d.money_left_on_table),
    created_at: String(d.created_at),
  };
}

export async function listDeals(userId: string, opts?: { since?: Date }): Promise<DealRow[]> {
  const supabase = await createClient();
  let q = supabase.from('deals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (opts?.since) q = q.gte('created_at', opts.since.toISOString());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDealRow);
}

export async function getPeriodToDate(
  userId: string,
  plan: CompPlan,
): Promise<PeriodToDate & { deals: DealRow[] }> {
  const deals = await listDeals(userId, { since: startOfPeriod(plan.period) });
  return { ...periodToDateFrom(deals), deals };
}
