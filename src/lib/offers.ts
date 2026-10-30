import { sellsEquipment, type CompPlan, type DealInput, type PeriodToDate, type QuarterToDate } from '@/lib/calc';
import { closeWith } from '@/lib/closeout';
import type { Line, Targets } from '@/components/discounts';

/**
 * A sign-by offer: a concession on an open quote that holds only if it's
 * signed by a date, then reverts. Not a price cut: a reason for the buyer to
 * sign now that has nothing to do with the rep's quota. The suggestion
 * spends from the line that costs the rep least for what the buyer saves,
 * never past the rep's own discount target or the company's limit, and never
 * one that would cost them quota or the accelerator the period is counting on.
 */

const FIELD: Record<Line, { pct: 'subscriptionDiscountPct' | 'oneTimeDiscountPct' | 'hardwareDiscountPct'; year: (d: DealInput) => number }> = {
  software: { pct: 'subscriptionDiscountPct', year: (d) => (d.subMode === 'acv' ? d.subscription : d.subscription * 12) },
  services: { pct: 'oneTimeDiscountPct', year: (d) => d.oneTime },
  hardware: { pct: 'hardwareDiscountPct', year: (d) => d.hardware ?? 0 },
};

/** With no target set, an offer moves a line this many points at most. */
const STEP = 10;
/** An offer that costs quota credit is suggested only when the period still
 *  clears quota by this share of it afterwards: near the line, hold the price. */
const CUSHION = 0.05;

export type OfferPlan = {
  line: Line;
  fromPct: number;
  toPct: number;
  /** The quote with the offer on it. */
  deal: DealInput;
  /** First-year price the buyer saves. */
  buyerSaves: number;
  /** Commission it costs the rep this period, anything it moves on quota included. */
  cost: number;
  /** Change in quota credit (negative when a line that counts is discounted). */
  creditChange: number;
  /** Whether the rep's own target set the ceiling (else the STEP did). */
  byTarget: boolean;
};

export type OfferSuggestion =
  | { kind: 'offer'; offer: OfferPlan; worth: number }
  | { kind: 'none'; reason: 'past-targets' | 'breaks-quota'; worth: number };
// 'breaks-quota': the only room left is on a line that counts toward quota,
// and the period is too close to the line to give any of it.

const pctOf = (d: DealInput, line: Line) => Number(d[FIELD[line].pct] ?? 0);

/**
 * The best sign-by offer for `deal`, closing alongside `others` (the rest
 * of what the rep expects to close this period).
 */
export function suggestOffer(
  plan: CompPlan,
  ptd: PeriodToDate,
  qtd: QuarterToDate | null,
  deal: DealInput,
  others: DealInput[],
  targets: Targets,
): OfferSuggestion {
  const base = closeWith(plan, ptd, qtd, [...others, deal]);
  const without = closeWith(plan, ptd, qtd, others);
  const worth = base.commission - without.commission;
  const hitsNow = base.after.creditBooked >= plan.quota;

  const lines: Line[] = ['services', 'software', ...(sellsEquipment(plan) ? (['hardware'] as Line[]) : [])];
  const plans: OfferPlan[] = [];
  let anyRoom = false;
  for (const line of lines) {
    const year = FIELD[line].year(deal);
    if (!(year > 0)) continue;
    const from = pctOf(deal, line);
    // Never past the rep's own target or the company's limit, whichever is lower.
    const target = targets[line];
    const limit = plan.limits?.[line];
    const ceiling = Math.min(target ?? 100, limit ?? 100);
    const to = target !== undefined ? ceiling : Math.min(ceiling, from + STEP);
    if (!(to > from + 0.5)) continue;
    anyRoom = true;
    const offered: DealInput = { ...deal, [FIELD[line].pct]: to };
    const run = closeWith(plan, ptd, qtd, [...others, offered]);
    plans.push({
      line,
      fromPct: from,
      toPct: to,
      deal: offered,
      buyerSaves: year * ((to - from) / 100),
      cost: Math.max(0, base.commission - run.commission),
      creditChange: run.after.creditBooked - base.after.creditBooked,
      byTarget: target !== undefined && (limit === undefined || target <= limit),
    });
  }
  if (!anyRoom) return { kind: 'none', reason: 'past-targets', worth };
  // Never one that costs the period its quota, and near the line, none that
  // costs quota credit at all.
  const safe = plans.filter((p) => {
    if (!hitsNow || p.creditChange >= -0.5) return true;
    return base.after.creditBooked + p.creditChange >= plan.quota * (1 + CUSHION);
  });
  if (!safe.length) return { kind: 'none', reason: 'breaks-quota', worth };
  const best = safe.sort((a, b) => a.cost / a.buyerSaves - b.cost / b.buyerSaves)[0];
  return { kind: 'offer', offer: best, worth };
}

/** How a line reads in a sentence. */
export const LINE_WORDS: Record<Line, string> = {
  software: 'subscription',
  services: 'services (one-time)',
  hardware: 'equipment (one-time)',
};
