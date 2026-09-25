import { DEMO_PLAN, type DealInput } from '@/lib/calc';
import {
  OPENING_PTD,
  OPENING_QTD,
  SAMPLE,
  crossEffect,
  effectiveRateLabel,
  kickerCrossDiscountPct,
  kickerOutcomeCopy,
  outcome,
} from '@/components/opening';

/**
 * The sample deal, run through the real engine at a given subscription
 * discount, for the landing page's "How it works" illustrations. Computed,
 * not typed in, so the marketing can never drift from what the tool shows.
 */
export function sampleAt(pct: number) {
  const deal: DealInput = { ...SAMPLE, subscriptionDiscountPct: pct };
  const o = outcome(DEMO_PLAN, deal, OPENING_PTD);
  const bonus = kickerOutcomeCopy(DEMO_PLAN, crossEffect(DEMO_PLAN, o, OPENING_QTD), OPENING_QTD);
  return {
    pct,
    commission: o.r.commissionEffective,
    commissionable: o.r.commissionable,
    rate: effectiveRateLabel(DEMO_PLAN, o.r),
    discountsCost: o.atStake,
    creditAfter: o.r.creditAfter,
    bonus,
  };
}

/** Where the sample deal loses its Quarterly Bonus. */
export const SAMPLE_BONUS_LINE = kickerCrossDiscountPct(DEMO_PLAN, outcome(DEMO_PLAN, SAMPLE, OPENING_PTD), OPENING_QTD);
