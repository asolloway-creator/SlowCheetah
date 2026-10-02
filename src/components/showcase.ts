/**
 * The landing card's story, as numbers: a customer asks for one point more
 * than the bonus line allows, the bonus goes, and holding the line one
 * point back keeps it. Every figure comes from the engine on the deal and
 * quarter actually on screen, so the narration can't drift from the card.
 * No React in here.
 */

import type { CompPlan, DealInput, PeriodToDate, QuarterToDate } from '@/lib/calc';
import { crossEffect, holdLinePct, kickerCrossDiscountPct, outcome } from '@/components/opening';

export type ShowcaseScript = {
  /** Where the bonus is lost, exactly. */
  line: number;
  /** What the customer asks for: the first whole percent past the line. */
  ask: number;
  /** Where IOI holds the line: the most they can get and keep the bonus. */
  hold: number;
  /** The bonus this deal costs at `ask`. */
  lost: number;
  /** What the points between `hold` and `ask` save the customer in a year. */
  customerYear: number;
};

export function showcaseScript(
  plan: CompPlan,
  deal: DealInput,
  ptd: PeriodToDate,
  qtd: QuarterToDate | null,
): ShowcaseScript | null {
  if (!qtd) return null;
  const line = kickerCrossDiscountPct(plan, outcome(plan, deal, ptd), qtd);
  if (line === null || line >= 99) return null;
  const ask = Math.floor(line) + 1;
  const asked = { ...deal, subscriptionDiscountPct: ask };
  const oAsk = outcome(plan, asked, ptd);
  const x = crossEffect(plan, oAsk, qtd);
  if (!x?.costsATier) return null;
  const hold = holdLinePct(plan, asked, ptd, qtd);
  if (hold === null || hold >= ask) return null;
  return { line, ask, hold, lost: x.value, customerYear: (oAsk.r.subAnnualList * (ask - hold)) / 100 };
}
