/**
 * IOI commission engine — generic, two proven plan shapes.
 *
 * Generalized only as far as the real plans we've seen (per the original
 * spec's "don't guess" rule):
 *  - Toast-style: monthly unit quota, commission as a % of commissionable
 *    deal value, rate SWITCHES to an accelerated % once N units land.
 *  - MarginEdge-style: quarterly ARR quota, commission as N months of MRR,
 *    a RETROACTIVE % bump on the whole period once quota is met.
 * Plus the flat-rate-no-accelerator case. Straight SaaS only — any add-on
 * is bundled into the subscription line, not tracked as its own product.
 */

export type Period = 'month' | 'quarter';
export type QuotaBasis = 'units' | 'arr';
export type CommissionStyle = 'percent' | 'months_of_mrr';
export type AcceleratorStyle = 'none' | 'rate_switch' | 'retro_bump';
export type SubscriptionMode = 'mrr' | 'acv';

/** One tier of a quarterly kicker: cross this % of the quarterly SaaS
 *  target, and the whole quarter's SaaS commission gets this % bump. */
export type QuarterlyKickerTier = {
  attainmentPct: number;
  kickerPct: number;
};

/**
 * A second, independent incentive some real plans stack on top of whatever
 * `accelerator_style` already models — a tiered bonus on cumulative
 * quarterly SaaS attainment, always tracked against the calendar quarter
 * regardless of `plan.period`. Fixed at two tiers rather than an arbitrary
 * list: matches the shape of a confirmed real plan, not a guess at plans
 * nobody's shown us yet.
 */
export type QuarterlyKicker = {
  /** Quarterly SaaS ARR target — 100% attainment. */
  target: number;
  tiers: [QuarterlyKickerTier, QuarterlyKickerTier];
};

export type CompPlan = {
  role_name: string;
  period: Period;
  quota_basis: QuotaBasis;
  /** Units per period, or new ARR $ per period. */
  quota: number;
  commission_style: CommissionStyle;
  /** 'percent': % of commissionable value. 'months_of_mrr': months of MRR. */
  base_rate: number;
  accelerator_style: AcceleratorStyle;
  /** Same basis as quota. Ignored when accelerator_style is 'none'. */
  accelerator_threshold: number;
  /** 'rate_switch': the accelerated rate (same unit as base_rate).
   *  'retro_bump': the % bump applied to the whole period. */
  accelerator_rate: number;
  /** % of one-time revenue that is commissionable ('percent' style). One
   *  bucket for every non-recurring cost on the deal — hardware,
   *  implementation, setup fees, whatever a given plan charges once. */
  one_time_weight: number;
  /** Optional, independent of accelerator_style — most plans don't have
   *  one. See QuarterlyKicker. */
  quarterly_kicker: QuarterlyKicker | null;
};

export type DealInput = {
  oneTime: number;
  subscription: number;
  subMode: SubscriptionMode;
  units: number;
  oneTimeDiscountPct: number;
  subscriptionDiscountPct: number;
};

/** Period-to-date position, rebuilt from saved deals. */
export type PeriodToDate = {
  /** Units or discounted ARR booked so far, per quota_basis. */
  creditBooked: number;
  /** Sum of commission at BASE rate (pre-accelerator). */
  commissionBooked: number;
  /** Sum of commission as earned at save time (rate_switch already applied). */
  earnedBooked: number;
};

export type CalcResult = {
  units: number;
  /** Monthly subscription, at list. */
  subMrrList: number;
  subMrr: number;
  subAnnualList: number;
  subAnnual: number;
  /** Commissionable value ('percent' style) at list / after discount. */
  commissionableFull: number;
  commissionable: number;
  /** Commission at base rate, pre-accelerator. */
  commissionBase: number;
  commissionFullBase: number;
  /** Commission as it will actually pay on this deal (accelerator applied). */
  commissionEffective: number;
  commissionFullEffective: number;
  /** The SaaS-only slice of commissionEffective — all of it for
   *  months_of_mrr plans (already 100% SaaS by construction), the
   *  proportional share attributable to subscription revenue for percent
   *  plans that blend in one-time. What a quarterly SaaS kicker multiplies
   *  against; kept separate because the blended commissionEffective isn't
   *  otherwise splittable after the fact. */
  saasCommissionEffective: number;
  /** The rate shown to the user (percent or months) after accelerator. */
  effectiveRate: number;
  hasDiscount: boolean;
  lost: number;
  customerSavesAnnual: number;
  /** Quota credit this deal adds (units or ARR). */
  credit: number;
  creditFull: number;
  creditAfter: number;
  wasAccelerated: boolean;
  isAccelerated: boolean;
  crossesAccelerator: boolean;
  /** retro_bump only: extra unlocked on prior deals if this one crosses. */
  retroBump: number;
  /** retro_bump only: what crossing is worth on prior deals right now. */
  crossingWorth: number;
  discountBlocksAccelerator: boolean;
  attained: boolean;
  toQuota: number;
  quotaPct: number;
  totalPayoutImpact: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function calc(plan: CompPlan, deal: DealInput, ptd: PeriodToDate): CalcResult {
  const units = Math.max(1, Math.round(deal.units));
  const dOt = clamp(deal.oneTimeDiscountPct, 0, 100) / 100;
  const dSub = clamp(deal.subscriptionDiscountPct, 0, 100) / 100;

  const subMrrList = deal.subMode === 'acv' ? deal.subscription / 12 : deal.subscription;
  const subMrr = subMrrList * (1 - dSub);
  const subAnnualList = subMrrList * 12;
  const subAnnual = subMrr * 12;

  const otDisc = deal.oneTime * (1 - dOt);

  const w1 = plan.one_time_weight / 100;
  const commissionableFull = deal.oneTime * w1 + subAnnualList;
  const commissionable = otDisc * w1 + subAnnual;

  const commissionAt = (rate: number, full: boolean) =>
    plan.commission_style === 'percent'
      ? (full ? commissionableFull : commissionable) * (rate / 100)
      : rate * (full ? subMrrList : subMrr);

  const commissionBase = commissionAt(plan.base_rate, false);
  const commissionFullBase = commissionAt(plan.base_rate, true);

  // Quota credit. Discounted ARR counts; units are units.
  const credit = plan.quota_basis === 'units' ? units : subAnnual;
  const creditFull = plan.quota_basis === 'units' ? units : subAnnualList;
  const creditAfter = ptd.creditBooked + credit;

  const hasAccel = plan.accelerator_style !== 'none';
  const threshold = hasAccel ? plan.accelerator_threshold : Infinity;
  const wasAccelerated = hasAccel && ptd.creditBooked >= threshold;
  const isAccelerated = hasAccel && creditAfter >= threshold;
  const crossesAccelerator = !wasAccelerated && isAccelerated;

  let commissionEffective = commissionBase;
  let commissionFullEffective = commissionFullBase;
  let effectiveRate = plan.base_rate;
  let retroBump = 0;
  let crossingWorth = 0;

  if (plan.accelerator_style === 'rate_switch' && isAccelerated) {
    effectiveRate = plan.accelerator_rate;
    commissionEffective = commissionAt(plan.accelerator_rate, false);
    commissionFullEffective = commissionAt(plan.accelerator_rate, true);
  } else if (plan.accelerator_style === 'retro_bump') {
    const mult = 1 + plan.accelerator_rate / 100;
    crossingWorth = (plan.accelerator_rate / 100) * ptd.commissionBooked;
    if (isAccelerated) {
      commissionEffective = commissionBase * mult;
      commissionFullEffective = commissionFullBase * mult;
    }
    if (crossesAccelerator) retroBump = crossingWorth;
  }

  // The proportional slice of commissionEffective attributable to
  // subscription revenue — for months_of_mrr plans commissionEffective is
  // already 100% SaaS, no split needed. For percent plans that blend in
  // one-time at some weight, split by the same ratio the blend was built
  // from, so it carries through whatever accelerator effect already
  // applied above.
  const saasCommissionEffective =
    plan.commission_style === 'months_of_mrr'
      ? commissionEffective
      : commissionable > 0
        ? commissionEffective * (subAnnual / commissionable)
        : 0;

  const hasDiscount = dOt > 0 || dSub > 0;
  const lost = commissionFullEffective - commissionEffective;
  const customerSavesAnnual = deal.oneTime * dOt + subAnnualList * dSub;

  const fullPriceCrosses = hasAccel && ptd.creditBooked + creditFull >= threshold;
  const discountBlocksAccelerator = !isAccelerated && fullPriceCrosses;

  const attained = creditAfter >= plan.quota;
  const toQuota = Math.max(0, plan.quota - creditAfter);
  const quotaPct = plan.quota > 0 ? Math.min(100, Math.round((creditAfter / plan.quota) * 100)) : 0;

  return {
    units,
    subMrrList,
    subMrr,
    subAnnualList,
    subAnnual,
    commissionableFull,
    commissionable,
    commissionBase,
    commissionFullBase,
    commissionEffective,
    commissionFullEffective,
    saasCommissionEffective,
    effectiveRate,
    hasDiscount,
    lost,
    customerSavesAnnual,
    credit,
    creditFull,
    creditAfter,
    wasAccelerated,
    isAccelerated,
    crossesAccelerator,
    retroBump,
    crossingWorth,
    discountBlocksAccelerator,
    attained,
    toQuota,
    quotaPct,
    totalPayoutImpact: commissionEffective + retroBump,
  };
}

/** Period-level payout from saved deals. Retro bumps are applied here. */
export function periodSummary(plan: CompPlan, ptd: PeriodToDate) {
  const hasAccel = plan.accelerator_style !== 'none';
  const accelerated = hasAccel && ptd.creditBooked >= plan.accelerator_threshold;
  const attained = ptd.creditBooked >= plan.quota;
  const retro = plan.accelerator_style === 'retro_bump';
  const payout =
    retro && accelerated ? ptd.commissionBooked * (1 + plan.accelerator_rate / 100) : ptd.earnedBooked;
  return {
    accelerated,
    attained,
    toQuota: Math.max(0, plan.quota - ptd.creditBooked),
    toAccelerator: hasAccel ? Math.max(0, plan.accelerator_threshold - ptd.creditBooked) : 0,
    quotaPct: plan.quota > 0 ? Math.min(100, Math.round((ptd.creditBooked / plan.quota) * 100)) : 0,
    payout,
    /** retro_bump: bump already earned (if accelerated) or waiting to unlock. */
    acceleratorValue: retro ? (plan.accelerator_rate / 100) * ptd.commissionBooked : 0,
  };
}

/** Rebuild a period-to-date position from stored deal rows. */
export function periodToDateFrom(
  rows: { quota_credit: number; commission_base: number; commission_earned: number }[],
): PeriodToDate {
  return {
    creditBooked: rows.reduce((s, d) => s + d.quota_credit, 0),
    commissionBooked: rows.reduce((s, d) => s + d.commission_base, 0),
    earnedBooked: rows.reduce((s, d) => s + d.commission_earned, 0),
  };
}

/** Calendar-quarter aggregate for the kicker — always scoped to the real
 *  quarter via startOfPeriod('quarter'), independent of plan.period. A
 *  sibling to PeriodToDate rather than a 4th field on it: PeriodToDate is
 *  used unconditionally everywhere, and most plans have no kicker to make
 *  a quarterly figure meaningful. */
export type QuarterToDate = {
  /** Discounted new ARR booked this calendar quarter, all deals. */
  saasArrBooked: number;
  /** Sum of each deal's own saasCommissionEffective this quarter. */
  saasCommissionBooked: number;
};

export function quarterToDateFrom(
  rows: { arr: number; saas_commission: number }[],
): QuarterToDate {
  return {
    saasArrBooked: rows.reduce((s, d) => s + d.arr, 0),
    saasCommissionBooked: rows.reduce((s, d) => s + d.saas_commission, 0),
  };
}

/** The highest tier reached at this ARR attainment, or null below Tier 1. */
export function kickerTierAt(kicker: QuarterlyKicker, arrBooked: number): QuarterlyKickerTier | null {
  if (kicker.target <= 0) return null;
  const pct = (arrBooked / kicker.target) * 100;
  return [...kicker.tiers].sort((a, b) => b.attainmentPct - a.attainmentPct).find((t) => pct >= t.attainmentPct) ?? null;
}

/** Quarter-level kicker status — the toAccelerator/quotaPct analogue of
 *  periodSummary(), for the second, independent metric. */
export function quarterlyKickerSummary(plan: CompPlan, qtd: QuarterToDate) {
  const kicker = plan.quarterly_kicker;
  if (!kicker) return null;
  const attainmentPct = kicker.target > 0 ? (qtd.saasArrBooked / kicker.target) * 100 : 0;
  const tier = kickerTierAt(kicker, qtd.saasArrBooked);
  const nextTier = [...kicker.tiers].sort((a, b) => a.attainmentPct - b.attainmentPct).find((t) => t.attainmentPct > attainmentPct) ?? null;
  return {
    tier,
    attainmentPct,
    bumpValue: tier ? qtd.saasCommissionBooked * (tier.kickerPct / 100) : 0,
    nextTier,
    toNextTierArr: nextTier ? Math.max(0, (kicker.target * nextTier.attainmentPct) / 100 - qtd.saasArrBooked) : 0,
  };
}

/**
 * A plausible "mid-period, closing in on your accelerator" scenario for any
 * plan — the same story the default demo tells (three-quarters of the way
 * to quota, one deal away from crossing), generated from whatever numbers a
 * visitor enters instead of hand-authored once for a single shape. `booked`
 * is prior history; `starter` is sized to close the remaining gap when it
 * lands, so the line moves and the accelerator fires the moment their plan
 * is in — the same moment the pre-seeded demo opens on, not an empty form.
 */
export function syntheticOpening(plan: CompPlan): { booked: DealInput; starter: DealInput } {
  const target = Math.max(1, plan.accelerator_style !== 'none' ? plan.accelerator_threshold : plan.quota);
  const bookedCredit = target * 0.75;
  const starterCredit = Math.max(target - bookedCredit, target * 0.05);

  // Rounding to whole units/dollars-a-month can undershoot the credit it was
  // asked for. Fine for the booked portion, but the starter deal's whole
  // job is to visibly close the gap — rounded down, it can land a few
  // dollars short and turn "crosses the accelerator" into an anticlimactic
  // near-miss. Round it up instead: never short, at worst a dollar or two
  // over.
  const dealFor = (credit: number, roundUp = false): DealInput => {
    const round = roundUp ? Math.ceil : Math.round;
    if (plan.quota_basis === 'units') {
      const units = Math.max(1, round(credit));
      const size = units * 500;
      return { oneTime: size, subscription: size, subMode: 'mrr', units, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 };
    }
    const mrr = Math.max(1, round(credit / 12));
    return { oneTime: mrr, subscription: mrr, subMode: 'mrr', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 };
  };

  return { booked: dealFor(bookedCredit), starter: dealFor(starterCredit, true) };
}

// ── Period helpers ───────────────────────────────────────────────────────────

export function startOfPeriod(period: Period, now = new Date()): Date {
  return period === 'quarter'
    ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
}

export function periodLabel(period: Period, d = new Date()): string {
  return period === 'quarter'
    ? `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
    : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function periodOf(period: Period, iso: string): string {
  return periodLabel(period, new Date(iso));
}

// ── Presets ──────────────────────────────────────────────────────────────────

export type Preset = { id: string; name: string; blurb: string; plan: CompPlan };

export const PRESETS: Preset[] = [
  {
    id: 'arr-retro',
    name: 'Quarterly ARR · retroactive accelerator',
    blurb:
      'Earn N months of MRR per deal. Cross the ARR quota and a % bump applies to the whole quarter, past deals included.',
    plan: {
      role_name: 'Account Executive',
      period: 'quarter',
      quota_basis: 'arr',
      quota: 100000,
      commission_style: 'months_of_mrr',
      base_rate: 2,
      accelerator_style: 'retro_bump',
      accelerator_threshold: 100000,
      accelerator_rate: 25,
      one_time_weight: 0,
      quarterly_kicker: null,
    },
  },
  {
    id: 'units-switch',
    name: 'Monthly units · rate accelerator',
    blurb:
      'Commission is a % of commissionable deal value. Hit quota and every deal that month earns the accelerated rate. One-time products count at 40% weight.',
    plan: {
      role_name: 'Senior AE',
      period: 'month',
      quota_basis: 'units',
      quota: 8,
      commission_style: 'percent',
      base_rate: 7,
      accelerator_style: 'rate_switch',
      accelerator_threshold: 8,
      accelerator_rate: 9.5,
      one_time_weight: 40,
      quarterly_kicker: null,
    },
  },
  {
    id: 'flat',
    name: 'Flat rate · no accelerator',
    blurb: 'A straight % of commissionable value, every deal, all period long. Quota tracked, no rate change.',
    plan: {
      role_name: 'Account Executive',
      period: 'month',
      quota_basis: 'arr',
      quota: 40000,
      commission_style: 'percent',
      base_rate: 10,
      accelerator_style: 'none',
      accelerator_threshold: 0,
      accelerator_rate: 0,
      one_time_weight: 50,
      quarterly_kicker: null,
    },
  },
];

// The demo's front door: a monthly unit quota with a forward rate-switch,
// not the quarterly ARR retroactive-bump shape — closer to a real,
// structurally complex comp plan (weighted revenue types, a separate
// quota metric) than a single-number plan with one surprising mechanic.
//
// Carries its own quarterly_kicker — the preset itself stays null, this is
// the one demo instance that shows the cross-effect: a subscription
// discount that costs nothing on the monthly accelerator (crossesAccelerator
// is driven by units here, not $) can still drop quarterly SaaS attainment
// below a tier. Sized against the seeded deals in demo.ts / OPENING_QTD in
// opening.ts — see that file if these numbers ever need to move.
// 15%/20% -> 70%/85% (a prior pass) read as unrealistic for the percentage
// itself — real accelerator/SPIFF kickers don't run that high. The better
// lever is the dollar base kickerPct multiplies against: every $ amount in
// demo.ts's seeded deals and opening.ts's SAMPLE deal is scaled 3x from
// this file's original numbers (units, discount percentages, and this
// plan's own quota/rates untouched), and this target scales the same 3x
// (180,000 -> 540,000) so attainmentPct — a ratio of two things both
// scaled by the same factor — comes out byte-identical to before:
// 105.977% resting, crossing at 24.42% subscription discount, 103.977% at
// 50%, all unchanged. kickerPct only needed to move from 15/20 to a still-
// plausible 25/30 on top of that 3x base to clear $10,000 at rest
// ($10,780.92). See demo.ts's seedDeals()/seedQuarterHistory() and
// opening.ts's SAMPLE for the matching 3x — they all have to move
// together or this ratio (and OPENING_PTD/OPENING_QTD) drifts.
export const DEMO_PLAN: CompPlan = {
  ...PRESETS.find((p) => p.id === 'units-switch')!.plan,
  quarterly_kicker: {
    target: 540000,
    tiers: [
      { attainmentPct: 105, kickerPct: 25 },
      { attainmentPct: 130, kickerPct: 30 },
    ],
  },
};
