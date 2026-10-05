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
 *  target, and the whole quarter's SaaS commission gets this % bump, or,
 *  on a tier with an `amount`, a fixed bonus of that many dollars instead
 *  ("$9,000 at 100% of quota"). */
export type QuarterlyKickerTier = {
  attainmentPct: number;
  /** The % bump. 0 on a fixed-amount tier. */
  kickerPct: number;
  /** A fixed bonus, in dollars. Absent on a percent tier, which is every
   *  plan saved before fixed bonuses existed. */
  amount?: number;
};

/** A tier that pays a fixed amount rather than a share of commission. */
export const isFixedTier = (t: QuarterlyKickerTier) => typeof t.amount === 'number';

/** What reaching `tier` pays, given the quarter's SaaS commission. */
export function kickerTierValue(tier: QuarterlyKickerTier | null, saasCommission: number): number {
  if (!tier) return 0;
  return isFixedTier(tier) ? Math.max(0, tier.amount as number) : saasCommission * (tier.kickerPct / 100);
}

/**
 * A second, independent incentive some real plans stack on top of whatever
 * `accelerator_style` already models — a tiered bonus on cumulative
 * quarterly SaaS attainment, always tracked against the calendar quarter
 * regardless of `plan.period`. One or two tiers rather than an arbitrary
 * list: a single bonus level is the common case, and two is the most any
 * confirmed real plan has used.
 */
export type QuarterlyKicker = {
  /** Quarterly SaaS ARR target — 100% attainment. */
  target: number;
  tiers: [QuarterlyKickerTier] | [QuarterlyKickerTier, QuarterlyKickerTier];
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
  /** Further steps past the first one above, same style, each starting
   *  higher than the last: "12% past $150,000, 15% past $187,500" is the
   *  first step plus one here. Optional: most plans have a single step, and
   *  plans saved before steps existed have none. See acceleratorSteps(). */
  accelerator_steps?: AcceleratorStep[];
  /** % of one-time revenue that is commissionable ('percent' style). One
   *  bucket for every non-recurring cost on the deal — hardware,
   *  implementation, setup fees, whatever a given plan charges once. */
  one_time_weight: number;
  /** Optional, independent of accelerator_style — most plans don't have
   *  one. See QuarterlyKicker. */
  quarterly_kicker: QuarterlyKicker | null;
  /** Benchmarking metadata only — never read by calc() or anything else in
   *  this file. Optional; most saved plans won't have it yet. See
   *  COMPANY_SIZE_BANDS below for why size is a band, not a raw headcount. */
  industry: string | null;
  company_size_band: string | null;
};

/** The fixed set of company-size bands a plan can be tagged with — a band,
 *  never a raw headcount, by design: this is the same anonymization
 *  discipline real comp-benchmarking players (Radford, Pave, OpenComp) use.
 *  Cohorts form from bands, never from an exact number or a company name
 *  (which this schema doesn't capture at all). One list, shared by the
 *  plan form and (eventually) whatever reads this column for a cohort
 *  view — never hand-typed in two places to drift apart. */
export const COMPANY_SIZE_BANDS: [string, string][] = [
  ['1-50', '1-50 employees'],
  ['51-200', '51-200 employees'],
  ['201-500', '201-500 employees'],
  ['501-1000', '501-1,000 employees'],
  ['1001-5000', '1,001-5,000 employees'],
  ['5001+', '5,001+ employees'],
];

/** One accelerator step: from `threshold` (in quota's basis), `rate` is the
 *  rate every deal earns ('rate_switch') or the bump on the whole period's
 *  commission ('retro_bump'). A higher step replaces the one below it. */
export type AcceleratorStep = { threshold: number; rate: number };

/** Every accelerator step, the first included, in rising order. Empty without one. */
export function acceleratorSteps(plan: CompPlan): AcceleratorStep[] {
  if (plan.accelerator_style === 'none') return [];
  return [{ threshold: plan.accelerator_threshold, rate: plan.accelerator_rate }, ...(plan.accelerator_steps ?? [])].sort(
    (a, b) => a.threshold - b.threshold,
  );
}

/** The highest step reached at `credit`, as an index into acceleratorSteps(); -1 below the first. */
export function stepIndexAt(steps: AcceleratorStep[], credit: number): number {
  let at = -1;
  steps.forEach((s, i) => {
    if (credit >= s.threshold) at = i;
  });
  return at;
}

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
  /** Past an accelerator step before this deal, and after it. */
  wasAccelerated: boolean;
  isAccelerated: boolean;
  /** This deal reaches a higher step than the period was on: the first one,
   *  or, on a plan with several, the next. */
  crossesAccelerator: boolean;
  /** The step reached before this deal, after it, and after it at full
   *  price: indexes into acceleratorSteps(plan), -1 below the first. */
  stepBefore: number;
  step: number;
  stepFull: number;
  /** retro_bump only: extra unlocked on prior deals if this one crosses. */
  retroBump: number;
  /** retro_bump only: what crossing the next step is worth on prior deals right now. */
  crossingWorth: number;
  /** Full price reaches a higher step than the discounted deal does. */
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

  const steps = acceleratorSteps(plan);
  const stepBefore = stepIndexAt(steps, ptd.creditBooked);
  const step = stepIndexAt(steps, creditAfter);
  const stepFull = stepIndexAt(steps, ptd.creditBooked + creditFull);
  const wasAccelerated = stepBefore >= 0;
  const isAccelerated = step >= 0;
  const crossesAccelerator = step > stepBefore;

  let commissionEffective = commissionBase;
  let commissionFullEffective = commissionFullBase;
  let effectiveRate = plan.base_rate;
  let retroBump = 0;
  let crossingWorth = 0;

  if (plan.accelerator_style === 'rate_switch' && isAccelerated) {
    effectiveRate = steps[step].rate;
    commissionEffective = commissionAt(effectiveRate, false);
    commissionFullEffective = commissionAt(effectiveRate, true);
  } else if (plan.accelerator_style === 'retro_bump') {
    // A higher step's bump replaces the one below it, on the whole period.
    const bump = (i: number) => (i >= 0 ? steps[i].rate : 0);
    const next = steps[stepBefore + 1];
    crossingWorth = next ? ((next.rate - bump(stepBefore)) / 100) * ptd.commissionBooked : 0;
    if (isAccelerated) {
      const mult = 1 + bump(step) / 100;
      commissionEffective = commissionBase * mult;
      commissionFullEffective = commissionFullBase * mult;
    }
    if (crossesAccelerator) retroBump = ((bump(step) - bump(stepBefore)) / 100) * ptd.commissionBooked;
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

  const discountBlocksAccelerator = stepFull > step;

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
    stepBefore,
    step,
    stepFull,
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
  const steps = acceleratorSteps(plan);
  const at = stepIndexAt(steps, ptd.creditBooked);
  const accelerated = at >= 0;
  const step = accelerated ? steps[at] : null;
  const next = steps[at + 1] ?? null;
  const attained = ptd.creditBooked >= plan.quota;
  const retro = plan.accelerator_style === 'retro_bump';
  const payout = retro && step ? ptd.commissionBooked * (1 + step.rate / 100) : ptd.earnedBooked;
  return {
    accelerated,
    attained,
    /** The step reached, and the next one up (the first, below it). */
    step,
    next,
    /** Only once past more than one step. */
    stepNumber: at + 1,
    toQuota: Math.max(0, plan.quota - ptd.creditBooked),
    /** To the next step up; 0 past the last. */
    toAccelerator: next ? Math.max(0, next.threshold - ptd.creditBooked) : 0,
    quotaPct: plan.quota > 0 ? Math.min(100, Math.round((ptd.creditBooked / plan.quota) * 100)) : 0,
    payout,
    /** retro_bump: the bump already earned (once past a step) or what the first would unlock. */
    acceleratorValue: retro ? (((step ?? next)?.rate ?? 0) / 100) * ptd.commissionBooked : 0,
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
    bumpValue: kickerTierValue(tier, qtd.saasCommissionBooked),
    nextTier,
    toNextTierArr: nextTier ? Math.max(0, (kicker.target * nextTier.attainmentPct) / 100 - qtd.saasArrBooked) : 0,
  };
}

// ── Where a rep starts ───────────────────────────────────────────────────────

/**
 * What a rep had already booked before they started using IOI: their real
 * starting point, entered by them, so where they stand reflects the period
 * they're actually in rather than starting from zero. Never filed with plan
 * records; it lives with the working plan (the browser, or the account).
 *
 * Tied to the period it was entered for and ignored once that period ends.
 */
export type Opening = {
  /** periodKey of the plan's own period when this was entered: '2026-10' or '2026-Q4'. */
  periodKey: string;
  /** Quota credit already booked that period: units or new ARR, per quota_basis. */
  credit: number;
  /** periodKey('quarter') when this was entered. */
  quarterKey: string;
  /** New ARR already booked that calendar quarter, for a quarterly bonus, when
   *  it had to be asked for separately (see needsQuarterArr). */
  quarterArr: number | null;
};

/** What a person types: the keys are stamped when it's saved. */
export type OpeningInput = { credit: number; quarterArr: number | null };

/** A plan with a quarterly bonus whose own quota isn't already the quarter's ARR
 *  needs the quarter's ARR asked for on its own. */
export function needsQuarterArr(plan: CompPlan): boolean {
  return Boolean(plan.quarterly_kicker) && !(plan.quota_basis === 'arr' && plan.period === 'quarter');
}

/** Base-rate commission on new ARR, by the plan's own rules: what ARR booked
 *  before IOI is counted at, since IOI never saw those deals. */
function commissionOnArr(plan: CompPlan, arr: number): number {
  return plan.commission_style === 'percent' ? (arr * plan.base_rate) / 100 : (arr / 12) * plan.base_rate;
}

/** The quarter's ARR a starting point stands for. */
export function openingQuarterArr(plan: CompPlan, o: Opening): number {
  if (o.quarterArr !== null) return o.quarterArr;
  return plan.quota_basis === 'arr' && plan.period === 'quarter' ? o.credit : 0;
}

/** The period's position with the starting point added, when it was entered
 *  for this period (`key`). Units carry no dollars, so a units starting point
 *  moves the accelerator but adds no commission. */
export function withPeriodOpening(plan: CompPlan, ptd: PeriodToDate, o: Opening | null, key: string): PeriodToDate {
  if (!o || o.periodKey !== key || !(o.credit > 0)) return ptd;
  const commission = plan.quota_basis === 'arr' ? commissionOnArr(plan, o.credit) : 0;
  return {
    creditBooked: ptd.creditBooked + o.credit,
    commissionBooked: ptd.commissionBooked + commission,
    earnedBooked: ptd.earnedBooked + commission,
  };
}

/** The quarter's position with the starting point added, when it was entered
 *  for this quarter (`key`). */
export function withQuarterOpening(plan: CompPlan, qtd: QuarterToDate, o: Opening | null, key: string): QuarterToDate {
  if (!o || o.quarterKey !== key) return qtd;
  const arr = openingQuarterArr(plan, o);
  if (!(arr > 0)) return qtd;
  return {
    saasArrBooked: qtd.saasArrBooked + arr,
    saasCommissionBooked: qtd.saasCommissionBooked + commissionOnArr(plan, arr),
  };
}

/** The starting point that applies right now, or null once its period has passed. */
export function currentOpening(o: Opening | null, key: string): Opening | null {
  return o && o.periodKey === key ? o : null;
}

/**
 * The deal the deal page opens on for a plan of the rep's own, sized from
 * where they really stand (`creditBooked`). When the accelerator is within
 * one deal's reach, a deal that crosses it, with room to discount on ARR
 * plans: the moment worth seeing on your own numbers. Otherwise a deal a
 * quarter of the way to it. Never saved anywhere; it's what the builder
 * shows until the rep types their own deal.
 */
export function starterDeal(plan: CompPlan, creditBooked: number): DealInput {
  // The next accelerator step up from here, or the quota without one (or past the last).
  const next = acceleratorSteps(plan).find((s) => s.threshold > creditBooked);
  const target = Math.max(1, next ? next.threshold : plan.accelerator_style !== 'none' ? plan.accelerator_threshold : plan.quota);
  const typical = target * 0.25;
  const gap = Math.max(0, target - creditBooked);
  const withinReach = gap > 0 && gap <= typical * 1.2;
  const credit = withinReach ? (plan.quota_basis === 'arr' ? gap * 1.2 : gap) : typical;

  if (plan.quota_basis === 'units') {
    const units = Math.max(1, Math.ceil(credit - 1e-9));
    // A unit's dollar size isn't in a units plan's own numbers. A quarterly
    // bonus gives one real signal, its ARR target, so size units off it
    // (assuming the unit quota roughly maps to that target); otherwise $500
    // a month is a plain placeholder nothing else derives from.
    const unitsPerQuarter = plan.period === 'month' ? plan.quota * 3 : plan.quota;
    const perUnitMrr =
      plan.quarterly_kicker && plan.quarterly_kicker.target > 0 && unitsPerQuarter > 0
        ? Math.max(100, Math.round(plan.quarterly_kicker.target / unitsPerQuarter / 12))
        : 500;
    const size = units * perUnitMrr;
    return { oneTime: size, subscription: size, subMode: 'mrr', units, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 };
  }
  // Rounded up, so a deal meant to cross never lands a dollar short.
  const mrr = Math.max(1, Math.ceil(credit / 12));
  return { oneTime: mrr, subscription: mrr, subMode: 'mrr', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 };
}

// ── Quotes ───────────────────────────────────────────────────────────────────

/**
 * A deal the rep is still working: saved so they can come back to it, and
 * counted in what their open quotes would add up to. Not booked; booking one
 * turns it into a deal and takes it off the list.
 */
export type Quote = {
  id: string;
  /** The rep's own label; may be empty. */
  name: string;
  deal: DealInput;
  createdAt: string;
  updatedAt: string;
};

export type Pipeline = {
  count: number;
  /** Everything they'd pay, each landing on top of the ones before. */
  commission: number;
  /** The part of `commission` that's a retroactive bump on deals already
   *  closed (retro_bump plans), rather than commission on the quotes. */
  unlocked: number;
  creditAfter: number;
  /** Past an accelerator step once they all land. */
  accelerated: boolean;
  /** ...a higher one than before they did. */
  crossesAccelerator: boolean;
  /** The next step up once they all land, if there is one. */
  next: AcceleratorStep | null;
  /** The quarterly bonus once they all land, when the plan has one. */
  kicker: ReturnType<typeof quarterlyKickerSummary>;
};

/**
 * What a set of open quotes adds up to if they all close as quoted, in the
 * order given, each against the position the ones before it leave: so a later
 * quote that crosses the accelerator pays (and unlocks) what it really would.
 */
export function pipeline(plan: CompPlan, ptd: PeriodToDate, qtd: QuarterToDate | null, deals: DealInput[]): Pipeline {
  let p = ptd;
  let q = qtd;
  let commission = 0;
  let unlocked = 0;
  for (const deal of deals) {
    const r = calc(plan, deal, p);
    commission += r.totalPayoutImpact;
    unlocked += r.retroBump;
    p = {
      creditBooked: p.creditBooked + r.credit,
      commissionBooked: p.commissionBooked + r.commissionBase,
      earnedBooked: p.earnedBooked + r.commissionEffective,
    };
    if (q) q = { saasArrBooked: q.saasArrBooked + r.subAnnual, saasCommissionBooked: q.saasCommissionBooked + r.saasCommissionEffective };
  }
  const steps = acceleratorSteps(plan);
  const before = stepIndexAt(steps, ptd.creditBooked);
  const after = stepIndexAt(steps, p.creditBooked);
  return {
    count: deals.length,
    commission,
    unlocked,
    creditAfter: p.creditBooked,
    accelerated: after >= 0,
    crossesAccelerator: after > before,
    next: steps[after + 1] ?? null,
    kicker: q ? quarterlyKickerSummary(plan, q) : null,
  };
}

// ── Period helpers ───────────────────────────────────────────────────────────

export function startOfPeriod(period: Period, now = new Date()): Date {
  return period === 'quarter'
    ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
}

/** The UTC-instant offset (in minutes) between `date` and how `timeZone`
 *  reads that same instant — evaluated at `date` itself, not cached, so
 *  DST transitions resolve correctly on either side of the change. */
function utcOffsetMinutes(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUTC - date.getTime()) / 60000;
}

/**
 * `startOfPeriod`'s server-side counterpart: the rep's own calendar, not
 * the server's. `startOfPeriod` above reads `now`'s LOCAL getters, which
 * is exactly right in the browser (demo.ts) — the runtime's local zone
 * already is the visitor's. It's wrong on the server, where "local" means
 * Vercel's UTC: a rep closing a deal at 9pm Eastern on the last day of the
 * month — already past midnight UTC — would have it silently counted
 * toward next month instead of the one they were racing to hit. This
 * computes "today" from `timeZone` (the rep's own, via a client-set
 * cookie — see queries.ts) instead of the runtime's, then finds the exact
 * UTC instant that midnight-on-the-1st corresponds to THERE, so the
 * Supabase `created_at >= since` filter lines up with the rep's own
 * calendar regardless of what timezone the query happens to run in. */
export function startOfPeriodInZone(period: Period, timeZone: string, now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const year = +parts.year;
  const month = +parts.month - 1;
  const startMonth = period === 'quarter' ? Math.floor(month / 3) * 3 : month;
  const guessUTC = Date.UTC(year, startMonth, 1);
  const offsetMin = utcOffsetMinutes(new Date(guessUTC), timeZone);
  return new Date(guessUTC - offsetMin * 60000);
}

export function periodLabel(period: Period, d = new Date()): string {
  return period === 'quarter'
    ? `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
    : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function periodOf(period: Period, iso: string): string {
  return periodLabel(period, new Date(iso));
}

/** A stable name for the period a date falls in: '2026-10', or '2026-Q4' for a
 *  quarter. Local time, like startOfPeriod: right in the browser. */
export function periodKey(period: Period, d = new Date()): string {
  return keyFor(period, d.getFullYear(), d.getMonth());
}

/** periodKey in the rep's own time zone, for the server (see startOfPeriodInZone). */
export function periodKeyInZone(period: Period, timeZone: string, now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  return keyFor(period, +parts.year, +parts.month - 1);
}

function keyFor(period: Period, year: number, month: number): string {
  return period === 'quarter' ? `${year}-Q${Math.floor(month / 3) + 1}` : `${year}-${String(month + 1).padStart(2, '0')}`;
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
      industry: null,
      company_size_band: null,
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
      industry: null,
      company_size_band: null,
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
      industry: null,
      company_size_band: null,
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
// below a tier. Sized against DEMO_PTD/DEMO_QTD below and SAMPLE in
// opening.ts: see those if these numbers ever need to move.
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
// ($10,780.92). DEMO_PTD/DEMO_QTD below and opening.ts's SAMPLE carry
// the matching 3x; they all have to move together or this ratio drifts.
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

/**
 * Where the sample's rep stands: 6 of 8 units into the month (one deal from
 * the accelerator) and 102% of the Quarterly Bonus target, close enough that
 * a discount on the sample deal decides it. Fixed numbers rather than a
 * script of dated deals, so the sample never depends on today's date: it
 * once seeded a quarter of history that, early in a quarter, either counted
 * twice or showed deals from the previous quarter.
 */
export const DEMO_PTD: PeriodToDate = { creditBooked: 6, commissionBooked: 11068.68, earnedBooked: 11068.68 };
export const DEMO_QTD: QuarterToDate = { saasArrBooked: 550674, saasCommissionBooked: 41071.68 };
