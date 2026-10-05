'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  calc,
  currentOpening,
  periodKey,
  periodToDateFrom,
  quarterToDateFrom,
  startOfPeriod,
  withPeriodOpening,
  withQuarterOpening,
  DEMO_PLAN,
  DEMO_PTD,
  DEMO_QTD,
  type CompPlan,
  type DealInput,
  type Opening,
  type OpeningInput,
  type PeriodToDate,
  type Quote,
} from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { track } from '@/lib/track';
import { DEMO_KEY } from '@/lib/demo-flag';

/**
 * Demo mode: the whole app running against the visitor's browser. Deals never
 * leave the machine. The plan stays here too, except that confirming one
 * files its rules anonymously (lib/plan-record). Usage events carry which
 * moment happened, never its numbers (lib/track.ts). Signing in is the "keep
 * this" upsell.
 *
 * Nothing here is invented. The stock sample is a fixed position (DEMO_PTD /
 * DEMO_QTD in calc.ts) with no deals behind it. A visitor's own plan starts
 * from what they say they've already booked (`opening`), plus the deals they
 * book here.
 */

const KEY = DEMO_KEY;
/** v4: no seeded or synthetic deals; `opening` instead. */
const VERSION = 4;

type DemoState = { v?: number; plan: CompPlan; deals: DealRow[]; seeded: boolean; opening?: Opening | null; quotes?: Quote[] };

function rowFromDeal(plan: CompPlan, deal: DealInput, ptd: PeriodToDate, createdAt: Date, id?: string): DealRow {
  const r = calc(plan, deal, ptd);
  return {
    id: id ?? `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
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
    ...((deal.hardware ?? 0) > 0
      ? {
          hardware_amount: deal.hardware,
          hardware_discount_pct: deal.hardwareDiscountPct ?? 0,
          hardware_commission: Number(r.hardwareCommission.toFixed(2)),
        }
      : {}),
    created_at: createdAt.toISOString(),
  };
}

const dealFromRow = (d: DealRow): DealInput => ({
  oneTime: d.one_time_amount,
  subscription: d.subscription_amount,
  subMode: d.subscription_mode,
  units: d.units,
  oneTimeDiscountPct: d.one_time_discount_pct,
  subscriptionDiscountPct: d.subscription_discount_pct,
  ...((d.hardware_amount ?? 0) > 0 ? { hardware: d.hardware_amount, hardwareDiscountPct: d.hardware_discount_pct ?? 0 } : {}),
});

/**
 * Every deal re-run, oldest first, against the plan and starting point as they
 * stand now: what each paid depends on where its period stood when it landed.
 * Run after the plan's rules or the starting point change, so a corrected rate
 * or a later "I'd already booked 4 units" reprices what's already here instead
 * of leaving it at the old math (or wiping it).
 */
function rerun(plan: CompPlan, deals: DealRow[], opening: Opening | null): DealRow[] {
  const byPeriod = new Map<string, DealRow[]>();
  const out: DealRow[] = [];
  for (const d of [...deals].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const at = new Date(d.created_at);
    const key = periodKey(plan.period, at);
    const prior = byPeriod.get(key) ?? [];
    const row = rowFromDeal(plan, dealFromRow(d), withPeriodOpening(plan, periodToDateFrom(prior), opening, key), at, d.id);
    byPeriod.set(key, [...prior, row]);
    out.push(row);
  }
  return out.reverse();
}

/**
 * Saved before v4, a visitor's own plan came with invented history: one deal
 * dated a few days before the plan was saved (always the oldest row, its
 * one-time and subscription amounts equal, no discount) and, for plans with
 * a quarterly bonus, two `carry` rows from earlier months. Their plan and the
 * deals they really booked are kept; the invented rows go, and they start
 * from zero until they add what they'd booked.
 */
function migrate(s: DemoState): DemoState {
  if (s.v === VERSION) return s;
  if (s.seeded) return fresh();
  const real = s.deals.filter((d) => !(d as DealRow & { carry?: boolean }).carry);
  const oldest = [...real].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const invented =
    oldest &&
    oldest.one_time_amount === oldest.subscription_amount &&
    oldest.one_time_discount_pct === 0 &&
    oldest.subscription_discount_pct === 0;
  const deals = invented ? real.filter((d) => d.id !== oldest.id) : real;
  return { v: VERSION, plan: s.plan, deals: rerun(s.plan, deals, null), seeded: false, opening: null };
}

function fresh(): DemoState {
  return { v: VERSION, plan: DEMO_PLAN, deals: [], seeded: true, opening: null };
}

// Module-level store so useSyncExternalStore has a stable snapshot. The server
// snapshot is null, which renders nothing until the browser hydrates.
let cache: DemoState | null = null;
const listeners = new Set<() => void>();

function read(): DemoState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as DemoState) : null;
    cache = stored ? migrate(stored) : fresh();
    if (cache !== stored) localStorage.setItem(KEY, JSON.stringify(cache));
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
    return raw ? migrate(JSON.parse(raw) as DemoState) : null;
  } catch {
    return null;
  }
}

/** The visitor's own deals, as typed, for carrying into an account on sign-in. */
export function demoDealsForImport(): { deal: DealInput; createdAt: string }[] {
  const s = peekDemoState();
  return s && !s.seeded ? s.deals.map((d) => ({ deal: dealFromRow(d), createdAt: d.created_at })) : [];
}

/** The visitor's open quotes, for carrying into an account on sign-in. */
export function demoQuotesForImport(): Quote[] {
  const s = peekDemoState();
  return s && !s.seeded ? (s.quotes ?? []) : [];
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

  const seeded = state?.seeded ?? true;
  const plan = state?.plan ?? DEMO_PLAN;
  const deals = seeded ? [] : (state?.deals ?? []);
  const quotes = seeded ? [] : [...(state?.quotes ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const since = startOfPeriod(plan.period).getTime();
  const periodDeals = deals.filter((d) => new Date(d.created_at).getTime() >= since);
  // Only while it applies: a starting point entered last month means nothing now.
  const opening = seeded ? null : currentOpening(state?.opening ?? null, periodKey(plan.period));

  // The sample is a fixed position. A visitor's own plan: their deals, plus
  // where they said they started. The quarter is always the calendar quarter,
  // independent of plan.period, same as the account path in queries.ts.
  const quarterSince = startOfPeriod('quarter').getTime();
  const ptd = seeded ? DEMO_PTD : withPeriodOpening(plan, periodToDateFrom(periodDeals), opening, periodKey(plan.period));
  const qtd = seeded
    ? DEMO_QTD
    : withQuarterOpening(
        plan,
        quarterToDateFrom(deals.filter((d) => new Date(d.created_at).getTime() >= quarterSince)),
        state?.opening ?? null,
        periodKey('quarter'),
      );

  return {
    ready: state !== null,
    // Whether savePlan() has ever succeeded, independent of whether the
    // values entered happen to match the stock plan's own numbers.
    seeded,
    plan,
    deals,
    periodDeals,
    opening,
    quotes,
    ptd,
    qtd,
    saveDeal: async (deal: DealInput) => {
      update((s) => {
        const key = periodKey(s.plan.period);
        const sinceNow = startOfPeriod(s.plan.period).getTime();
        const current = s.deals.filter((d) => new Date(d.created_at).getTime() >= sinceNow);
        const position = withPeriodOpening(s.plan, periodToDateFrom(current), s.opening ?? null, key);
        return { ...s, deals: [rowFromDeal(s.plan, deal, position, new Date()), ...s.deals] };
      });
      return {};
    },
    deleteDeal: async (id: string) => {
      update((s) => ({ ...s, deals: rerun(s.plan, s.deals.filter((d) => d.id !== id), s.opening ?? null) }));
      return {};
    },
    // From the sample, nothing carries over: its position isn't the visitor's.
    // An edit to their own plan keeps their deals, re-run under the new rules,
    // and keeps their starting point unless what it counts (units or ARR, a
    // month or a quarter) changed.
    savePlan: async (plan: CompPlan) => {
      update((s) => {
        if (s.seeded) return { v: VERSION, plan, deals: [], seeded: false, opening: null, quotes: [] };
        const sameMeasure = s.plan.quota_basis === plan.quota_basis && s.plan.period === plan.period;
        const opening = sameMeasure ? (s.opening ?? null) : null;
        return { ...s, v: VERSION, plan, opening, deals: rerun(plan, s.deals, opening) };
      });
      track('plan_saved', 'own');
      return {};
    },
    setOpening: async (input: OpeningInput) => {
      update((s) => {
        const opening: Opening = {
          periodKey: periodKey(s.plan.period),
          credit: Math.max(0, input.credit || 0),
          quarterKey: periodKey('quarter'),
          quarterArr: input.quarterArr === null ? null : Math.max(0, input.quarterArr || 0),
        };
        return { ...s, opening, deals: rerun(s.plan, s.deals, opening) };
      });
      return {};
    },
    // A quote is the deal as typed, plus a label: nothing in it depends on the
    // plan, so plan edits leave quotes alone and they re-price on the page.
    saveQuote: async (q: { id?: string | null; name: string; deal: DealInput }) => {
      const now = new Date().toISOString();
      const id = q.id ?? `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      update((s) => {
        const list = s.quotes ?? [];
        const before = list.find((x) => x.id === id);
        const saved: Quote = {
          id,
          name: q.name.replace(/\s+/g, ' ').trim().slice(0, 80),
          deal: q.deal,
          createdAt: before?.createdAt ?? now,
          updatedAt: now,
        };
        return { ...s, quotes: [saved, ...list.filter((x) => x.id !== id)] };
      });
      return { id };
    },
    deleteQuote: async (id: string) => {
      update((s) => ({ ...s, quotes: (s.quotes ?? []).filter((q) => q.id !== id) }));
      return {};
    },
    reset: () => update(() => fresh()),
  };
}
