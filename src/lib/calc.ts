/**
 * MarginEdge commission engine.
 *
 * Built from Bob's spec (2026-08-21) plus the published onboarding menus:
 *  - Reps earn 2 months of SaaS per deal ($350/mo software per location,
 *    +$150/mo Freepour Smart Scale — Freepour attaches to EVERY location on a
 *    deal or none of them, so an attached deal is $500/mo per location).
 *  - Quarterly quota: $107,000 in new ARR.
 *  - Accelerator: once quota is met, a 25% bump applies to every deal closed
 *    after AND retroactively to pre-quota deal attainment.
 *  - Onboarding packages pay the rep a flat bonus ($250/$500/$750 by package).
 *  - Payouts are quarterly (shifting to monthly eventually — display only).
 *
 * Open questions for Bob (defaults chosen, all editable in plan config):
 *  1. Package→bonus mapping assumed by price order: Launch $250, Boost $500,
 *     Accelerate $750.
 *  2. Does the 25% bump hit package bonuses too? Assumed NO (commission only);
 *     `accelerator_on_bonuses` flips it.
 *  3. Side dishes: Bob says some pay out and some don't. Which ones is TBD,
 *     so they stay out of the commission payout and count as deal value only.
 */

export type OnboardingPackage = 'launch' | 'boost' | 'accelerate';

export type CompPlan = {
  role_name: string;
  quarterly_arr_quota: number;
  /** Months of SaaS earned per deal (Bob: 2). */
  commission_months: number;
  /** Accelerator bump percent once quota is met (Bob: 25). */
  accelerator_pct: number;
  /** Whether the bump also applies to package bonuses. Ask Bob; default false. */
  accelerator_on_bonuses: boolean;
  /** Monthly SaaS per location (Bob: 350). */
  software_mrr: number;
  /** Freepour Smart Scale monthly per location (Bob: 150). */
  freepour_mrr: number;
  bonus_launch: number;
  bonus_boost: number;
  bonus_accelerate: number;
};

/** Bob's numbers, preloaded so setup is one click. */
export const MARGINEDGE_DEFAULTS: CompPlan = {
  role_name: 'Account Executive',
  quarterly_arr_quota: 107000,
  commission_months: 2,
  accelerator_pct: 25,
  accelerator_on_bonuses: false,
  software_mrr: 350,
  freepour_mrr: 150,
  bonus_launch: 250,
  bonus_boost: 500,
  bonus_accelerate: 750,
};

/** Onboarding menu list prices (company revenue, not rep comp). */
export const ONBOARDING_PRICES: Record<OnboardingPackage, { first: number; additional: number }> = {
  launch: { first: 500, additional: 250 },
  boost: { first: 750, additional: 250 },
  accelerate: { first: 2000, additional: 250 },
};

export const PACKAGE_LABELS: Record<OnboardingPackage, string> = {
  launch: 'Launch',
  boost: 'Boost',
  accelerate: 'Accelerate',
};

/** Side-dish list prices from the onboarding menu. */
export const SIDE_DISH_PRICES = {
  recipe: 5, // per recipe
  qbo: 500,
  commissary: 750,
  invoiceBackMonth: 150, // per additional month
} as const;

export type SideDishes = {
  recipes: number;
  qbo: boolean;
  commissary: boolean;
  invoiceBackMonths: number;
};

export type DealInput = {
  locations: number;
  /** Freepour attaches to every location on the deal, or none. */
  freepour: boolean;
  pkg: OnboardingPackage;
  saasDiscountPct: number;
  /** Discount on one-time costs (onboarding + side dishes). Does not touch
   *  the rep's flat package bonus, only company revenue and customer savings. */
  oneTimeDiscountPct: number;
  sideDishes: SideDishes;
};

/** Quarter-to-date position, rebuilt from saved deals. */
export type QuarterToDate = {
  arrBooked: number;
  /** Sum of base (pre-accelerator) commissions this quarter. */
  commissionBooked: number;
  bonusesBooked: number;
};

export type CalcResult = {
  /** Monthly SaaS per location after Freepour attach decision. */
  mrrPerLocation: number;
  /** Deal MRR at list price. */
  mrrList: number;
  /** Deal MRR after discount. */
  mrr: number;
  arrList: number;
  arr: number;
  /** Base commission (commission_months x discounted MRR), pre-accelerator. */
  commissionBase: number;
  /** Base commission at list price, pre-accelerator. */
  commissionFullBase: number;
  bonus: number;
  /** Onboarding package revenue at list price (company). */
  onboardingRevenueList: number;
  sideDishRevenueList: number;
  /** One-time revenue (onboarding + side dishes) at list price. */
  oneTimeRevenueList: number;
  /** One-time revenue after the one-time discount. */
  oneTimeRevenue: number;
  hasDiscount: boolean;
  hasOneTimeDiscount: boolean;

  // Quarter position
  arrAfter: number;
  wasAccelerated: boolean;
  isAccelerated: boolean;
  /** This deal is the one that crosses the quarterly quota. */
  crossesQuota: boolean;
  /** Extra unlocked on this quarter's PRIOR deals if this deal crosses. */
  retroBump: number;
  /** Commission on this deal after the accelerator multiplier, if active. */
  commissionEffective: number;
  /** commissionEffective + bonus (+ bonus bump if configured) + retroBump. */
  totalPayoutImpact: number;
  /** Money left on table at the effective (accelerated) rate. */
  lost: number;
  customerSavesMonthly: number;
  customerSavesOneTime: number;
  /** Full-price ARR would have crossed quota but the discounted ARR does not. */
  discountBlocksAccelerator: boolean;
  arrToQuota: number;
  quotaPct: number;
  /** What crossing quota is worth on the quarter's prior deals right now. */
  crossingWorth: number;
};

const bonusFor = (plan: CompPlan, pkg: OnboardingPackage) =>
  pkg === 'launch' ? plan.bonus_launch : pkg === 'boost' ? plan.bonus_boost : plan.bonus_accelerate;

export function onboardingRevenueFor(pkg: OnboardingPackage, locations: number): number {
  const p = ONBOARDING_PRICES[pkg];
  return p.first + Math.max(0, locations - 1) * p.additional;
}

export function sideDishRevenueFor(s: SideDishes): number {
  return (
    s.recipes * SIDE_DISH_PRICES.recipe +
    (s.qbo ? SIDE_DISH_PRICES.qbo : 0) +
    (s.commissary ? SIDE_DISH_PRICES.commissary : 0) +
    s.invoiceBackMonths * SIDE_DISH_PRICES.invoiceBackMonth
  );
}

export function calc(plan: CompPlan, deal: DealInput, qtd: QuarterToDate): CalcResult {
  const locations = Math.max(1, deal.locations);
  const accel = 1 + plan.accelerator_pct / 100;

  const mrrPerLocation = plan.software_mrr + (deal.freepour ? plan.freepour_mrr : 0);
  const mrrList = locations * mrrPerLocation;
  const d = Math.min(100, Math.max(0, deal.saasDiscountPct));
  const mrr = mrrList * (1 - d / 100);
  const arrList = mrrList * 12;
  const arr = mrr * 12;

  const commissionBase = plan.commission_months * mrr;
  const commissionFullBase = plan.commission_months * mrrList;
  const bonus = bonusFor(plan, deal.pkg);

  const onboardingRevenueList = onboardingRevenueFor(deal.pkg, locations);
  const sideDishRevenueList = sideDishRevenueFor(deal.sideDishes);
  const oneTimeRevenueList = onboardingRevenueList + sideDishRevenueList;
  const otD = Math.min(100, Math.max(0, deal.oneTimeDiscountPct));
  const oneTimeRevenue = oneTimeRevenueList * (1 - otD / 100);

  // Quarter position. Discounted (actual) ARR counts toward quota.
  const arrAfter = qtd.arrBooked + arr;
  const wasAccelerated = qtd.arrBooked >= plan.quarterly_arr_quota;
  const isAccelerated = arrAfter >= plan.quarterly_arr_quota;
  const crossesQuota = !wasAccelerated && isAccelerated;

  const mult = isAccelerated ? accel : 1;
  const commissionEffective = commissionBase * mult;
  const commissionFullEffective = commissionFullBase * mult;

  // Crossing quota retroactively bumps everything already closed this quarter.
  const priorBump =
    plan.accelerator_pct / 100 *
    (qtd.commissionBooked + (plan.accelerator_on_bonuses ? qtd.bonusesBooked : 0));
  const retroBump = crossesQuota ? priorBump : 0;

  const bonusEffective = plan.accelerator_on_bonuses && isAccelerated ? bonus * accel : bonus;
  const totalPayoutImpact = commissionEffective + bonusEffective + retroBump;

  const lost = commissionFullEffective - commissionEffective;
  const customerSavesMonthly = mrrList - mrr;
  const customerSavesOneTime = oneTimeRevenueList - oneTimeRevenue;

  // Would the full-price deal have crossed quota while the discounted one doesn't?
  const fullPriceCrosses = qtd.arrBooked + arrList >= plan.quarterly_arr_quota;
  const discountBlocksAccelerator = !isAccelerated && fullPriceCrosses;

  const arrToQuota = Math.max(0, plan.quarterly_arr_quota - arrAfter);
  const quotaPct = Math.min(100, Math.round((arrAfter / plan.quarterly_arr_quota) * 100));
  const crossingWorth = priorBump;

  return {
    mrrPerLocation,
    mrrList,
    mrr,
    arrList,
    arr,
    commissionBase,
    commissionFullBase,
    bonus,
    onboardingRevenueList,
    sideDishRevenueList,
    oneTimeRevenueList,
    oneTimeRevenue,
    hasDiscount: d > 0,
    hasOneTimeDiscount: otD > 0,
    arrAfter,
    wasAccelerated,
    isAccelerated,
    crossesQuota,
    retroBump,
    commissionEffective,
    totalPayoutImpact,
    lost,
    customerSavesMonthly,
    customerSavesOneTime,
    discountBlocksAccelerator,
    arrToQuota,
    quotaPct,
    crossingWorth,
  };
}

/**
 * Quarter-level payout summary from saved deals.
 * Commissions are stored pre-accelerator; the 25% is applied here at the
 * aggregate level because it is retroactive by nature.
 */
export function quarterSummary(plan: CompPlan, qtd: QuarterToDate) {
  const attained = qtd.arrBooked >= plan.quarterly_arr_quota;
  const accel = 1 + plan.accelerator_pct / 100;
  const commissionPayout = qtd.commissionBooked * (attained ? accel : 1);
  const bonusPayout = qtd.bonusesBooked * (attained && plan.accelerator_on_bonuses ? accel : 1);
  return {
    attained,
    arrToQuota: Math.max(0, plan.quarterly_arr_quota - qtd.arrBooked),
    quotaPct:
      plan.quarterly_arr_quota > 0
        ? Math.min(100, Math.round((qtd.arrBooked / plan.quarterly_arr_quota) * 100))
        : 0,
    basePayout: qtd.commissionBooked + qtd.bonusesBooked,
    payout: commissionPayout + bonusPayout,
    /** Extra the accelerator is already worth (if attained) or would unlock. */
    acceleratorValue:
      (plan.accelerator_pct / 100) *
      (qtd.commissionBooked + (plan.accelerator_on_bonuses ? qtd.bonusesBooked : 0)),
  };
}

// ── Quarter helpers ──────────────────────────────────────────────────────────

export function startOfQuarter(now = new Date()): Date {
  return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
}

export function quarterLabel(d = new Date()): string {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}
