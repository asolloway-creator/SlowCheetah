'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  calc,
  periodToDateFrom,
  startOfPeriod,
  DEMO_PLAN,
  type CompPlan,
  type DealInput,
  type PeriodToDate,
} from '@/lib/calc';
import type { DealRow } from '@/lib/queries';

/**
 * Demo mode: the whole app running against the visitor's browser.
 * Nothing leaves the machine. Signing in is the "keep this" upsell.
 */

const KEY = 'ioi-demo-v3';

type DemoState = { plan: CompPlan; deals: DealRow[]; seeded: boolean };

function rowFromDeal(plan: CompPlan, deal: DealInput, ptd: PeriodToDate, createdAt: Date): DealRow {
  const r = calc(plan, deal, ptd);
  return {
    id: `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    one_time_amount: deal.oneTime,
    implementation_amount: deal.implementation,
    subscription_amount: deal.subscription,
    subscription_mode: deal.subMode,
    units: r.units,
    attach: deal.attach,
    one_time_discount_pct: deal.oneTimeDiscountPct,
    implementation_discount_pct: deal.implementationDiscountPct,
    subscription_discount_pct: deal.subscriptionDiscountPct,
    quota_credit: Number(r.credit.toFixed(2)),
    arr: Number(r.subAnnual.toFixed(2)),
    commission_base: Number(r.commissionBase.toFixed(2)),
    commission_earned: Number(r.commissionEffective.toFixed(2)),
    money_left_on_table: Number(r.lost.toFixed(2)),
    created_at: createdAt.toISOString(),
  };
}

/** A mid-period rep: ~87% to quota, mixed attach, a couple of discounts. */
function seedDeals(plan: CompPlan): DealRow[] {
  const start = startOfPeriod(plan.period).getTime();
  const now = Date.now();
  const at = (f: number) => new Date(start + (now - start) * f);
  const D = (
    p: Partial<DealInput> & { subscription: number; units: number },
  ): DealInput => ({
    oneTime: 0, implementation: 0, subMode: 'mrr', attach: false,
    oneTimeDiscountPct: 0, implementationDiscountPct: 0, subscriptionDiscountPct: 0, ...p,
  });
  const script: [DealInput, number][] = [
    [D({ units: 2, subscription: 700, attach: true, oneTime: 1500 }), 0.08],
    [D({ units: 1, subscription: 350, subscriptionDiscountPct: 10, oneTime: 500 }), 0.2],
    [D({ units: 6, subscription: 2100, oneTime: 3000, implementation: 1500, oneTimeDiscountPct: 20 }), 0.35],
    [D({ units: 3, subscription: 1050, attach: true, oneTime: 2000 }), 0.55],
    [D({ units: 2, subscription: 700, oneTime: 750 }), 0.72],
    [D({ units: 5, subscription: 1750, subscriptionDiscountPct: 5, oneTime: 1750 }), 0.9],
  ];
  const rows: DealRow[] = [];
  for (const [deal, f] of script) {
    rows.push(rowFromDeal(plan, deal, periodToDateFrom(rows), at(f)));
  }
  return rows.reverse();
}

function fresh(): DemoState {
  return { plan: DEMO_PLAN, deals: seedDeals(DEMO_PLAN), seeded: true };
}

// Module-level store so useSyncExternalStore has a stable snapshot. The server
// snapshot is null, which renders nothing until the browser hydrates.
let cache: DemoState | null = null;
const listeners = new Set<() => void>();

function read(): DemoState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as DemoState) : fresh();
  } catch {
    cache = fresh();
  }
  return cache;
}

function write(next: DemoState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDemoStore() {
  const state = useSyncExternalStore(subscribe, read, () => null);

  const update = useCallback((fn: (s: DemoState) => DemoState) => {
    write(fn(read()));
  }, []);

  const plan = state?.plan ?? DEMO_PLAN;
  const deals = state?.deals ?? [];
  const since = startOfPeriod(plan.period).getTime();
  const periodDeals = deals.filter((d) => new Date(d.created_at).getTime() >= since);
  const ptd = periodToDateFrom(periodDeals);

  return {
    ready: state !== null,
    plan,
    deals,
    periodDeals,
    ptd,
    saveDeal: async (deal: DealInput) => {
      update((s) => {
        const sinceNow = startOfPeriod(s.plan.period).getTime();
        const current = s.deals.filter((d) => new Date(d.created_at).getTime() >= sinceNow);
        return { ...s, deals: [rowFromDeal(s.plan, deal, periodToDateFrom(current), new Date()), ...s.deals] };
      });
      return {};
    },
    deleteDeal: async (id: string) => {
      update((s) => ({ ...s, deals: s.deals.filter((d) => d.id !== id) }));
    },
    savePlan: async (plan: CompPlan) => {
      update((s) => ({ ...s, plan }));
      return {};
    },
    reset: () => update(() => fresh()),
  };
}
