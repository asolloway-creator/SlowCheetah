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

const D = (
  p: Partial<DealInput> & { subscription: number; units: number },
): DealInput => ({
  oneTime: 0, subMode: 'mrr',
  oneTimeDiscountPct: 0, subscriptionDiscountPct: 0, ...p,
});

/**
 * A mid-month rep: 6 of 8 units to the accelerator, several discounts —
 * sized so "left on the table" reads as a real, noticed number ($884.52)
 * rather than a rounding error ($57.33, the original sizing). Only two of
 * five rows carried a discount before; most real months look more like
 * this. See OPENING_PTD in opening.ts, hand-verified against this exact
 * script.
 *
 * Every dollar amount here is 3x the original sizing (units and discount
 * percentages untouched) — DEMO_PLAN's quarterly_kicker.target moved the
 * same 3x (calc.ts), which keeps attainmentPct (a ratio of two things both
 * scaled by the same factor) exactly where it was: same crossing point,
 * same accelerator math, just bigger absolute dollars so the kicker reads
 * as real money instead of raising kickerPct to an implausible rate. The 3x
 * has to hold across this whole function, seedQuarterHistory() below, and
 * SAMPLE in opening.ts, or OPENING_PTD/OPENING_QTD there drift.
 */
function seedDeals(plan: CompPlan): DealRow[] {
  const start = startOfPeriod(plan.period).getTime();
  const now = Date.now();
  const at = (f: number) => new Date(start + (now - start) * f);
  const script: [DealInput, number][] = [
    [D({ units: 1, subscription: 2100, oneTime: 3000 }), 0.1],
    [D({ units: 1, subscription: 2250, subscriptionDiscountPct: 18, oneTime: 2700 }), 0.3],
    [D({ units: 2, subscription: 4800, oneTime: 6000, oneTimeDiscountPct: 15 }), 0.5],
    [D({ units: 1, subscription: 2400, subscriptionDiscountPct: 25, oneTime: 3000 }), 0.7],
    [D({ units: 1, subscription: 2100, oneTime: 2700, oneTimeDiscountPct: 20 }), 0.9],
  ];
  const rows: DealRow[] = [];
  for (const [deal, f] of script) {
    rows.push(rowFromDeal(plan, deal, periodToDateFrom(rows), at(f)));
  }
  return rows.reverse();
}

/**
 * Two "already-booked" prior months, on top of seedDeals()'s current
 * month — a single month's commission pool is too small to make
 * DEMO_PLAN's quarterly_kicker land anywhere realistic. Each month is its
 * own 8-unit run (independently crossing its own monthly accelerator,
 * same as a real month would), giving the quarter a believable historical
 * position instead of a bare current-month slice.
 *
 * Dates are anchored relative to "now" (75 and 40 days back), clamped to
 * never predate the calendar quarter, rather than mapped onto real
 * calendar months — that keeps this correct and stable no matter what day
 * of the year the demo is viewed: 40+ days is always more than a month,
 * so these can never accidentally land inside the current month and get
 * double-counted into OPENING_PTD, and the Math.max floor means they're
 * still fully counted (not silently dropped) even when "now" is early in
 * the quarter. See OPENING_QTD in opening.ts, sized against this.
 */
function seedQuarterHistory(plan: CompPlan): DealRow[] {
  const quarterStart = startOfPeriod('quarter').getTime();
  const now = Date.now();
  const DAY = 86400000;
  const HOUR = 3600000;
  const monthScript = (deals: DealInput[], daysBack: number): DealRow[] => {
    const anchor = Math.max(quarterStart, now - daysBack * DAY);
    const rows: DealRow[] = [];
    deals.forEach((deal, i) => {
      rows.push(rowFromDeal(plan, deal, periodToDateFrom(rows), new Date(anchor + i * HOUR)));
    });
    return rows.reverse();
  };
  const month1 = monthScript(
    [
      D({ units: 1, subscription: 2040, oneTime: 2610 }),
      D({ units: 1, subscription: 2175, oneTime: 2475 }),
      D({ units: 2, subscription: 4410, oneTime: 4935 }),
      D({ units: 1, subscription: 1950, oneTime: 2325 }),
      D({ units: 1, subscription: 2085, oneTime: 2475 }),
      D({ units: 2, subscription: 4290, oneTime: 4785 }),
    ],
    75,
  );
  const month2 = monthScript(
    [
      D({ units: 1, subscription: 1920, oneTime: 2475 }),
      D({ units: 1, subscription: 2205, subscriptionDiscountPct: 10, oneTime: 2610 }),
      D({ units: 2, subscription: 4245, oneTime: 4785 }),
      D({ units: 1, subscription: 1980, oneTime: 2325 }),
      D({ units: 1, subscription: 2040, oneTime: 2385, oneTimeDiscountPct: 15 }),
      D({ units: 2, subscription: 4125, oneTime: 4650 }),
    ],
    40,
  );
  return [...month2, ...month1];
}

function fresh(): DemoState {
  return { plan: DEMO_PLAN, deals: [...seedDeals(DEMO_PLAN), ...seedQuarterHistory(DEMO_PLAN)], seeded: true };
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
    // Whether savePlan() has ever succeeded, independent of whether the
    // values entered happen to match the stock plan's own numbers — unlike
    // comparing `plan` to DEMO_PLAN by value, this stays correct even if
    // someone opens the plan dialog and resubmits the defaults unchanged.
    seeded: state?.seeded ?? true,
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
