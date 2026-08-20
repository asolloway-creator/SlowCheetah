/**
 * Commission engine, ported as-is from ioi-reference-prototype.html.
 *
 * Two changes from the prototype, both required by the MVP spec:
 *  1. The comp plan is read from the user's saved comp_plans row instead of the
 *     hardcoded COMP_PLANS demo object.
 *  2. `unitsBookedThisMonth` and `arrBookedThisMonth` come from saved deal
 *     history rather than a manually typed "deals booked this month" field.
 *
 * Dropped from the prototype, per "explicitly not built for this pilot":
 * the displacement SPIF, the past-quarter retrospective, and the demo role
 * switcher. The arithmetic that survives is byte-for-byte the same.
 */

/**
 * Commissionable value model. In the prototype these were org-level constants
 * (`CS`) rather than plan fields, and the spec's comp_plans table does not add
 * them, so they stay constants here. One-time and implementation revenue each
 * count at half weight; subscription MRR annualizes at 12x.
 */
export const COMMISSIONABLE = {
  oneTimeWeight: 50,
  implWeight: 50,
  subMult: 12,
} as const;

export type CompPlan = {
  role_name: string;
  monthly_unit_quota: number;
  base_rate: number;
  accelerator_threshold: number;
  accelerator_rate: number;
  monthly_arr_quota: number | null;
};

export type SubscriptionMode = 'mrr' | 'acv';

export type DealInput = {
  oneTime: number;
  implementation: number;
  subscription: number;
  subMode: SubscriptionMode;
  units: number;
  oneTimeDiscountPct: number;
  implementationDiscountPct: number;
  subscriptionDiscountPct: number;
};

/** Quota position going into this deal, derived from saved deal history. */
export type MonthToDate = {
  unitsBooked: number;
  arrBooked: number;
};

export type CalcResult = {
  unitsThis: number;
  /** Commissionable deal value at list price. */
  full: number;
  /** Commissionable deal value after discounts. */
  disc: number;
  /** Annualized subscription value after discount, for ARR pacing. */
  subAnnualDisc: number;
  /** Units booked this month after this deal lands. */
  unitsAfter: number;
  /** Accelerator active on this deal. */
  isAccelerated: boolean;
  /** This deal is the one that crosses the accelerator threshold. */
  triggersAccelerator: boolean;
  rate: number;
  hasDiscount: boolean;
  /** Commission actually earned. */
  commission: number;
  /** Commission at full list price. */
  fullCommission: number;
  /** fullCommission - commission. */
  lost: number;
  /** What the discount is worth to the customer. */
  customerSaves: number;
  unitsToAccelerator: number;
  unitPct: number;
  arrAfter: number;
  arrPct: number | null;
};

export function calc(plan: CompPlan, deal: DealInput, mtd: MonthToDate): CalcResult {
  const C = COMMISSIONABLE;
  const unitsThis = Math.max(1, deal.units);

  const dOt = deal.oneTime * (1 - deal.oneTimeDiscountPct / 100);
  const dImpl = deal.implementation * (1 - deal.implementationDiscountPct / 100);

  // Billing mode: 'mrr' annualizes a monthly figure, 'acv' treats the entry as
  // the annual contract value.
  const subAnnualFull =
    deal.subMode === 'acv' ? deal.subscription : deal.subscription * C.subMult;
  const subAnnualDisc = subAnnualFull * (1 - deal.subscriptionDiscountPct / 100);

  const full =
    (deal.oneTime * C.oneTimeWeight) / 100 +
    (deal.implementation * C.implWeight) / 100 +
    subAnnualFull;
  const disc =
    (dOt * C.oneTimeWeight) / 100 + (dImpl * C.implWeight) / 100 + subAnnualDisc;

  const unitsAfter = mtd.unitsBooked + unitsThis;
  const isAccelerated = unitsAfter >= plan.accelerator_threshold;
  const wasAccelerated = mtd.unitsBooked >= plan.accelerator_threshold;
  const triggersAccelerator = !wasAccelerated && isAccelerated;
  const rate = isAccelerated ? plan.accelerator_rate : plan.base_rate;

  const hasDiscount =
    deal.oneTimeDiscountPct > 0 ||
    deal.implementationDiscountPct > 0 ||
    deal.subscriptionDiscountPct > 0;

  const commission = (hasDiscount ? disc : full) * (rate / 100);
  const fullCommission = full * (rate / 100);
  const lost = fullCommission - commission;
  const customerSaves =
    (deal.oneTime * deal.oneTimeDiscountPct) / 100 +
    (deal.implementation * deal.implementationDiscountPct) / 100 +
    (subAnnualFull * deal.subscriptionDiscountPct) / 100;

  // Quota pace.
  const unitsToAccelerator = Math.max(0, plan.accelerator_threshold - unitsAfter);
  const unitPct = Math.min(100, Math.round((unitsAfter / plan.monthly_unit_quota) * 100));
  const arrAfter = mtd.arrBooked + subAnnualDisc;
  const arrPct =
    plan.monthly_arr_quota && plan.monthly_arr_quota > 0
      ? Math.min(100, Math.round((arrAfter / plan.monthly_arr_quota) * 100))
      : null;

  return {
    unitsThis,
    full,
    disc,
    subAnnualDisc,
    unitsAfter,
    isAccelerated,
    triggersAccelerator,
    rate,
    hasDiscount,
    commission,
    fullCommission,
    lost,
    customerSaves,
    unitsToAccelerator,
    unitPct,
    arrAfter,
    arrPct,
  };
}

/**
 * Annualized subscription revenue booked on a single saved deal, after
 * discount. Used to rebuild month-to-date ARR from deal history.
 */
export function dealAnnualizedArr(deal: {
  subscription_amount: number;
  subscription_mode: SubscriptionMode;
  subscription_discount_pct: number;
}): number {
  const full =
    deal.subscription_mode === 'acv'
      ? deal.subscription_amount
      : deal.subscription_amount * COMMISSIONABLE.subMult;
  return full * (1 - deal.subscription_discount_pct / 100);
}
