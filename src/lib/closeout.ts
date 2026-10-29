import {
  acceleratorSteps,
  calc,
  stepIndexAt,
  type CompPlan,
  type DealAccount,
  type DealInput,
  type Forecast,
  type PeriodToDate,
  type QuarterToDate,
  type Quote,
} from '@/lib/calc';
import { rateLift } from '@/components/discounts';

/**
 * Closing out a period: the rep's open quotes as the decisions they really
 * are (an account that decides as one is a single decision), the rep's own
 * call on each, and what the period comes to if the commits close, if the
 * likely ones do too, and if everything not pushed to next period does.
 * Every figure comes from the engine, in the order the rail lists them.
 */

/** One decision: a quote on its own, or every quote of an account that
 *  closes as one. */
export type CloseUnit = {
  key: string;
  label: string;
  account: DealAccount | null;
  quotes: Quote[];
  forecast: Forecast | null;
  /** An account whose quotes carry different calls; the most cautious one is used. */
  mixed: boolean;
};

/** How cautious a call is: an account's call is its most cautious quote's. */
const CAUTION: Record<Forecast, number> = { commit: 0, likely: 1, stretch: 2, next: 3 };

export function closeUnits(quotes: Quote[], accounts: DealAccount[]): CloseUnit[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const units: CloseUnit[] = [];
  const grouped = new Map<string, CloseUnit>();
  for (const q of quotes) {
    const account = q.accountId ? (byId.get(q.accountId) ?? null) : null;
    if (account?.oneDecision) {
      const u = grouped.get(account.id);
      if (u) {
        u.quotes.push(q);
        continue;
      }
      const unit: CloseUnit = { key: `a:${account.id}`, label: account.name || 'Unnamed account', account, quotes: [q], forecast: null, mixed: false };
      grouped.set(account.id, unit);
      units.push(unit);
    } else {
      units.push({ key: `q:${q.id}`, label: q.name.trim(), account, quotes: [q], forecast: q.forecast ?? null, mixed: false });
    }
  }
  for (const u of grouped.values()) {
    const calls = u.quotes.map((q) => q.forecast ?? null);
    const set = calls.filter((c): c is Forecast => c !== null);
    u.mixed = new Set(calls).size > 1;
    u.forecast = set.length === calls.length ? set.reduce((a, b) => (CAUTION[b] > CAUTION[a] ? b : a)) : null;
  }
  return units;
}

export type LineKey = 'commit' | 'best' | 'all';

export type CloseLine = {
  key: LineKey;
  units: CloseUnit[];
  /** Credit toward quota the period ends at. */
  credit: number;
  quota: number;
  hits: boolean;
  /** Credit still needed to reach quota (0 once there). */
  gap: number;
  /** The period's commission: what's booked, at the rate the period ends at, plus these deals. */
  commission: number;
  /** Commission these deals' discounts cost. */
  lost: number;
  /** First-year price their discounts give away. */
  givenAway: number;
  accelerated: boolean;
  /** On a retro accelerator not yet reached: what crossing would add on the whole period. */
  crossingWorth: number | null;
};

const LINE_CALLS: Record<LineKey, (f: Forecast | null) => boolean> = {
  commit: (f) => f === 'commit',
  best: (f) => f === 'commit' || f === 'likely',
  // Everything not pushed to next period, called or not.
  all: (f) => f !== 'next',
};

/** The quotes in a set of units, oldest first, like the rail's total. */
function dealsOf(units: CloseUnit[]): DealInput[] {
  return units
    .flatMap((u) => u.quotes)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((q) => q.deal);
}

/** First-year price a deal's discounts give away. */
function priceGivenAway(d: DealInput): number {
  const subYear = d.subMode === 'acv' ? d.subscription : d.subscription * 12;
  return (
    subYear * (d.subscriptionDiscountPct / 100) +
    d.oneTime * (d.oneTimeDiscountPct / 100) +
    (d.hardware ?? 0) * ((d.hardwareDiscountPct ?? 0) / 100)
  );
}

/** The period with these deals closed, in order, each priced against the period before it. */
export function closeWith(plan: CompPlan, ptd: PeriodToDate, qtd: QuarterToDate | null, deals: DealInput[]) {
  let p = ptd;
  let q = qtd;
  let added = 0;
  let lost = 0;
  let givenAway = 0;
  for (const deal of deals) {
    const r = calc(plan, deal, p);
    added += r.totalPayoutImpact;
    lost += r.lost;
    givenAway += priceGivenAway(deal);
    p = {
      ...p,
      creditBooked: p.creditBooked + r.credit,
      commissionBooked: p.commissionBooked + r.commissionBase,
      earnedBooked: p.earnedBooked + r.commissionEffective,
      hardwareBooked: (p.hardwareBooked ?? 0) + r.hardwareCommission,
    };
    if (q) q = { saasArrBooked: q.saasArrBooked + r.subAnnual, saasCommissionBooked: q.saasCommissionBooked + r.saasCommissionEffective };
  }
  // What's booked, as the period pays it now (on a retro plan every deal is
  // its base times the bump in force; elsewhere what was earned), plus what
  // these deals add, any bump they unlock included.
  const bookedNow =
    plan.accelerator_style === 'retro_bump'
      ? ptd.commissionBooked * rateLift(plan, ptd) + (ptd.hardwareBooked ?? 0)
      : ptd.earnedBooked;
  return { after: p, quarter: q, commission: bookedNow + added, lost, givenAway };
}

export function closeLine(
  plan: CompPlan,
  ptd: PeriodToDate,
  qtd: QuarterToDate | null,
  units: CloseUnit[],
  key: LineKey,
): CloseLine {
  const inLine = units.filter((u) => LINE_CALLS[key](u.forecast));
  const run = closeWith(plan, ptd, qtd, dealsOf(inLine));
  const credit = run.after.creditBooked;
  const steps = acceleratorSteps(plan);
  const idx = stepIndexAt(steps, credit);
  const next = steps[idx + 1];
  const crossingWorth =
    plan.accelerator_style === 'retro_bump' && next
      ? ((next.rate - (idx >= 0 ? steps[idx].rate : 0)) / 100) * run.after.commissionBooked
      : null;
  return {
    key,
    units: inLine,
    credit,
    quota: plan.quota,
    hits: credit >= plan.quota,
    gap: Math.max(0, plan.quota - credit),
    commission: run.commission,
    lost: run.lost,
    givenAway: run.givenAway,
    accelerated: idx >= 0,
    crossingWorth,
  };
}

/**
 * For a line that reaches quota: the decisions it can't do without (lose
 * one and the period falls short) and how much room is left.
 */
export function mustClose(plan: CompPlan, ptd: PeriodToDate, qtd: QuarterToDate | null, line: CloseLine) {
  if (!line.hits) return { must: [] as CloseUnit[], cushion: 0 };
  const must = line.units.filter((u) => {
    const rest = line.units.filter((x) => x !== u);
    return closeWith(plan, ptd, qtd, dealsOf(rest)).after.creditBooked < plan.quota;
  });
  return { must, cushion: line.credit - plan.quota };
}
