/**
 * IOI commission engine — generic, two proven plan shapes.
 *
 * Generalized only as far as the real plans we've seen (per the original
 * spec's "don't guess" rule):
 *  - Toast-style: monthly unit quota, commission as a % of commissionable
 *    deal value, rate SWITCHES to an accelerated % once N units land.
 *  - MarginEdge-style: quarterly ARR quota, commission as N months of MRR,
 *    a RETROACTIVE % bump on the whole period once quota is met.
 * Plus the flat-rate-no-accelerator case, and an optional per-unit attach
 * product (hardware add-on etc.) that feeds both commission and quota.
 */

export type Period = 'month' | 'quarter';
export type QuotaBasis = 'units' | 'arr';
export type CommissionStyle = 'percent' | 'months_of_mrr';
export type AcceleratorStyle = 'none' | 'rate_switch' | 'retro_bump';
export type SubscriptionMode = 'mrr' | 'acv';

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
  /** % of one-time / implementation revenue that is commissionable ('percent' style). */
  one_time_weight: number;
  implementation_weight: number;
  attach_enabled: boolean;
  attach_name: string;
  /** Monthly price per unit when the attach product is on the deal. */
  attach_mrr: number;
};

export type DealInput = {
  oneTime: number;
  implementation: number;
  subscription: number;
  subMode: SubscriptionMode;
  units: number;
  attach: boolean;
  oneTimeDiscountPct: number;
  implementationDiscountPct: number;
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
  /** Monthly subscription incl. attach, at list. */
  subMrrList: number;
  subMrr: number;
  subAnnualList: number;
  subAnnual: number;
  attachMrr: number;
  /** Commissionable value ('percent' style) at list / after discount. */
  commissionableFull: number;
  commissionable: number;
  /** Commission at base rate, pre-accelerator. */
  commissionBase: number;
  commissionFullBase: number;
  /** Commission as it will actually pay on this deal (accelerator applied). */
  commissionEffective: number;
  commissionFullEffective: number;
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
  oneTimeRevenue: number;
  oneTimeRevenueList: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function calc(plan: CompPlan, deal: DealInput, ptd: PeriodToDate): CalcResult {
  const units = Math.max(1, Math.round(deal.units));
  const dOt = clamp(deal.oneTimeDiscountPct, 0, 100) / 100;
  const dImpl = clamp(deal.implementationDiscountPct, 0, 100) / 100;
  const dSub = clamp(deal.subscriptionDiscountPct, 0, 100) / 100;

  const attachMrr = plan.attach_enabled && deal.attach ? plan.attach_mrr * units : 0;
  const baseMrr = deal.subMode === 'acv' ? deal.subscription / 12 : deal.subscription;
  const subMrrList = baseMrr + attachMrr;
  const subMrr = subMrrList * (1 - dSub);
  const subAnnualList = subMrrList * 12;
  const subAnnual = subMrr * 12;

  const otDisc = deal.oneTime * (1 - dOt);
  const implDisc = deal.implementation * (1 - dImpl);
  const oneTimeRevenueList = deal.oneTime + deal.implementation;
  const oneTimeRevenue = otDisc + implDisc;

  const w1 = plan.one_time_weight / 100;
  const w2 = plan.implementation_weight / 100;
  const commissionableFull = deal.oneTime * w1 + deal.implementation * w2 + subAnnualList;
  const commissionable = otDisc * w1 + implDisc * w2 + subAnnual;

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

  const hasDiscount = dOt > 0 || dImpl > 0 || dSub > 0;
  const lost = commissionFullEffective - commissionEffective;
  const customerSavesAnnual =
    deal.oneTime * dOt + deal.implementation * dImpl + subAnnualList * dSub;

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
    attachMrr,
    commissionableFull,
    commissionable,
    commissionBase,
    commissionFullBase,
    commissionEffective,
    commissionFullEffective,
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
    oneTimeRevenue,
    oneTimeRevenueList,
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
      'Earn N months of MRR per deal. Cross the ARR quota and a % bump applies to the whole quarter, past deals included. Optional per-unit hardware attach.',
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
      implementation_weight: 0,
      attach_enabled: true,
      attach_name: 'Hardware add-on',
      attach_mrr: 150,
    },
  },
  {
    id: 'units-switch',
    name: 'Monthly units · rate accelerator',
    blurb:
      'Commission is a % of commissionable deal value. Hit the unit threshold and every deal from there earns the accelerated rate. One-time and implementation count at half weight.',
    plan: {
      role_name: 'Senior AE',
      period: 'month',
      quota_basis: 'units',
      quota: 7,
      commission_style: 'percent',
      base_rate: 8.5,
      accelerator_style: 'rate_switch',
      accelerator_threshold: 6,
      accelerator_rate: 10.5,
      one_time_weight: 50,
      implementation_weight: 50,
      attach_enabled: false,
      attach_name: '',
      attach_mrr: 0,
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
      implementation_weight: 50,
      attach_enabled: false,
      attach_name: '',
      attach_mrr: 0,
    },
  },
];

export const DEMO_PLAN: CompPlan = PRESETS[0].plan;
