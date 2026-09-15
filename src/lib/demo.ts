'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  calc,
  periodToDateFrom,
  quarterToDateFrom,
  startOfPeriod,
  syntheticOpening,
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
    subscription_amount: deal.subscription,
    subscription_mode: deal.subMode,
    units: r.units,
    one_time_discount_pct: deal.oneTimeDiscountPct,
    subscription_discount_pct: deal.subscriptionDiscountPct,
    quota_credit: Number(r.credit.toFixed(2)),
    arr: Number(r.subAnnual.toFixed(2)),
    commission_base: Number(r.commissionBase.toFixed(2)),
    commission_earned: Number(r.commissionEffective.toFixed(2)),
    money_left_on_table: Number(r.lost.toFixed(2)),
    saas_commission: Number(r.saasCommissionEffective.toFixed(2)),
    created_at: createdAt.toISOString(),
  };
}

/** A mid-month rep: 6 of 8 units to the accelerator, a couple of discounts. */
function seedDeals(plan: CompPlan): DealRow[] {
  const start = startOfPeriod(plan.period).getTime();
  const now = Date.now();
  const at = (f: number) => new Date(start + (now - start) * f);
  const D = (
    p: Partial<DealInput> & { subscription: number; units: number },
  ): DealInput => ({
    oneTime: 0, subMode: 'mrr',
    oneTimeDiscountPct: 0, subscriptionDiscountPct: 0, ...p,
  });
  const script: [DealInput, number][] = [
    [D({ units: 1, subscription: 500, oneTime: 800 }), 0.1],
    [D({ units: 1, subscription: 650, subscriptionDiscountPct: 10, oneTime: 600 }), 0.3],
    [D({ units: 2, subscription: 900, oneTime: 1200 }), 0.5],
    [D({ units: 1, subscription: 550, oneTime: 700 }), 0.7],
    [D({ units: 1, subscription: 475, oneTime: 650, oneTimeDiscountPct: 15 }), 0.9],
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

/**
 * Read-only look at demo state for a signed-in session — unlike `read()`,
 * never seeds a fresh demo (that would spin up fake sample data inside a
 * real account). Returns null if there's nothing stored, or it can't be
 * parsed.
 */
export function peekDemoState(): DemoState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoState) : null;
  } catch {
    return null;
  }
}

/** Drops the demo entirely — used once its plan has been imported into a
 * real account, or the visitor declines, so a later sign-out starts clean
 * instead of resurrecting an orphaned customized demo. */
export function clearDemoState() {
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch {}
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

  // Always the calendar quarter, independent of plan.period — same
  // startOfPeriod('quarter') the real (Supabase) path uses in
  // getQuarterToDate. Cheap to always compute; only read when a plan
  // actually has a quarterly_kicker configured.
  const quarterSince = startOfPeriod('quarter').getTime();
  const qtd = quarterToDateFrom(deals.filter((d) => new Date(d.created_at).getTime() >= quarterSince));

  return {
    ready: state !== null,
    plan,
    deals,
    periodDeals,
    ptd,
    qtd,
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
    // A different plan invalidates every existing row's quota_credit — it
    // was computed under the old quota_basis/commission_style, and summing
    // it against the new plan is nonsense (a units count read as ARR
    // dollars, say). The seeded rows are scripted narrative for the old
    // plan anyway, not real history worth keeping — replaced with a
    // synthetic booked deal so /quota and /history land three-quarters to
    // the accelerator on the new plan, same as the default demo, instead of
    // a blank $0 that makes a real plan look like a broken one.
    savePlan: async (plan: CompPlan) => {
      const { booked } = syntheticOpening(plan);
      const row = rowFromDeal(plan, booked, { creditBooked: 0, commissionBooked: 0, earnedBooked: 0 }, new Date(Date.now() - 6 * 86400000));
      update((s) => ({ ...s, plan, deals: [row], seeded: false }));
      return {};
    },
    reset: () => update(() => fresh()),
  };
}
