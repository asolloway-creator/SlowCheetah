/**
 * The opening state, the outcome model and the copy — pure helpers shared by
 * the stage, the quota page and the OG image. No React in here.
 *
 * The one seam to know about: `calc().lost` compares discounted commission
 * with full-price commission at the *discounted* deal's accelerator state
 * ($110 in the opening state). The stage measures against the deal as it
 * would actually pay, via a full-price twin: `atStake` ($4,298.75) and
 * `lostOnDeal` ($660). Booked rows keep the engine's per-deal figure.
 * Do not "fix" this in calc.ts.
 */

import {
  calc,
  periodSummary,
  type CalcResult,
  type CompPlan,
  type DealInput,
  type PeriodToDate,
} from '@/lib/calc';
import { fmtCredit, fmtMoney, fmtPctShort, fmtRateShort, fmtSigned, periodNoun } from '@/lib/format';

export const EMPTY: DealInput = {
  oneTime: 0, implementation: 0, subscription: 0, subMode: 'mrr', units: 1,
  oneTimeDiscountPct: 0, implementationDiscountPct: 0, subscriptionDiscountPct: 0,
};

/** The seeded deal: $3,000 one-time, $1,100 MRR × 3 units, 5% off the subscription. */
export const SAMPLE: DealInput = {
  oneTime: 3000, implementation: 0, subscription: 1100, subMode: 'mrr', units: 3,
  oneTimeDiscountPct: 0, implementationDiscountPct: 0, subscriptionDiscountPct: 5,
};

/**
 * Mirror of demo.ts's seeded quarter, used only for the pre-hydration frame
 * and the OG image. A dev-mode check compares it to the store after hydration.
 */
export const OPENING_PTD: PeriodToDate = { creditBooked: 87330, commissionBooked: 14555, earnedBooked: 14555 };

export const isEmpty = (d: DealInput) => d.oneTime === 0 && d.implementation === 0 && d.subscription === 0;

export const atFullPrice = (d: DealInput): DealInput => ({
  ...d, oneTimeDiscountPct: 0, implementationDiscountPct: 0, subscriptionDiscountPct: 0,
});

export type DiscountKey = 'oneTimeDiscountPct' | 'implementationDiscountPct' | 'subscriptionDiscountPct';

export type OutcomeState = 'empty' | 'blocked' | 'crossed' | 'loss' | 'past' | 'held';

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function outcome(plan: CompPlan, deal: DealInput, ptd: PeriodToDate) {
  const r = calc(plan, deal, ptd);
  const rFull = calc(plan, atFullPrice(deal), ptd);
  const atStake = round2(rFull.totalPayoutImpact - r.totalPayoutImpact); // 4,298.75 in the opening state
  const lostOnDeal = round2(rFull.commissionEffective - r.commissionEffective); // 660

  // Crossing outranks a residual loss: at 4% off the deal crosses with $110
  // still on the table, and the page must flip to "Line held." right there.
  const state: OutcomeState = isEmpty(deal)
    ? 'empty'
    : r.discountBlocksAccelerator
      ? 'blocked'
      : r.crossesAccelerator
        ? 'crossed'
        : atStake > 0
          ? 'loss'
          : r.wasAccelerated
            ? 'past'
            : 'held';

  return { r, rFull, atStake, lostOnDeal, state };
}

export type Outcome = ReturnType<typeof outcome>;

/** What one discount costs the rep, in dollars, measured against the same deal without it. */
export function costOf(plan: CompPlan, deal: DealInput, ptd: PeriodToDate, key: DiscountKey): number {
  if (deal[key] <= 0) return 0;
  const without = calc(plan, { ...deal, [key]: 0 }, ptd);
  return round2(without.totalPayoutImpact - calc(plan, deal, ptd).totalPayoutImpact);
}

/** "2 months of MRR" · "2.5 months of MRR" once a retro bump applies · "10.5%". */
export function effectiveRateLabel(plan: CompPlan, r: CalcResult): string {
  if (plan.accelerator_style === 'retro_bump' && r.isAccelerated) {
    return fmtRateShort(plan, round2(plan.base_rate * (1 + plan.accelerator_rate / 100)));
  }
  return fmtRateShort(plan, r.effectiveRate);
}

// ── Copy ────────────────────────────────────────────────────────────────────

export type Tone = 'red' | 'green' | 'ink';

export type OutcomeCopy = {
  name: string;
  /** Colour of the h2: green in every held state, ink otherwise. */
  nameTone: 'green' | 'ink';
  figure: number | null;
  figureTone: Tone;
  signed: boolean;
  caption: string | null;
  sentence: string;
  /** Plain text for the live region and the pinned bar. */
  figureText: string;
};

export function outcomeCopy(plan: CompPlan, deal: DealInput, o: Outcome): OutcomeCopy {
  const { r } = o;
  const noun = periodNoun(plan);
  const retro = plan.accelerator_style === 'retro_bump';
  const th = fmtCredit(plan, plan.accelerator_threshold);
  const bump = `${fmtPctShort(plan.accelerator_rate)}`;
  const accelRate = fmtRateShort(plan, plan.accelerator_rate);
  const pct = fmtPctShort(deal.subscriptionDiscountPct);
  const onlySub = deal.subscriptionDiscountPct > 0 && deal.oneTimeDiscountPct === 0 && deal.implementationDiscountPct === 0;
  const residual =
    o.atStake > 0
      ? onlySub
        ? ` The ${pct} discount still costs you ${fmtMoney(o.atStake)} on this deal.`
        : ` Your discounts still cost you ${fmtMoney(o.atStake)} on this deal.`
      : '';

  switch (o.state) {
    case 'empty':
      return {
        name: 'Hold the line', nameTone: 'ink', figure: null, figureTone: 'ink', signed: false, caption: null,
        sentence: 'Enter what you’re selling and this fills itself in.', figureText: '',
      };
    case 'blocked':
      return {
        name: 'Left on the table', nameTone: 'ink', figure: o.atStake, figureTone: 'red', signed: false, caption: null,
        sentence: retro
          ? `This ${pct} discount keeps you under your accelerator. At full price this deal crosses ${th} and unlocks +${bump} on your whole ${noun} — worth ${fmtMoney(r.crossingWorth)} on top of the ${fmtMoney(o.lostOnDeal)} it already costs you.`
          : `This ${pct} discount keeps you under your accelerator. At full price this deal crosses ${th} and every deal after it earns ${accelRate}.`,
        figureText: fmtMoney(o.atStake),
      };
    case 'crossed':
      return retro
        ? {
            name: 'Line held.', nameTone: 'green', figure: r.retroBump, figureTone: 'green', signed: true,
            caption: 'unlocked on deals you already closed',
            sentence: `This deal crosses ${th} and every deal you’ve closed this ${noun} pays ${bump} more. This one pays ${fmtMoney(r.commissionEffective)}.${residual}`,
            figureText: fmtSigned(r.retroBump),
          }
        : {
            name: 'Line held.', nameTone: 'green', figure: r.commissionEffective, figureTone: 'green', signed: false,
            caption: `at ${effectiveRateLabel(plan, r)}, accelerated`,
            sentence: `This deal triggers your accelerator. Every deal after this one earns ${accelRate}.${residual}`,
            figureText: fmtMoney(r.commissionEffective),
          };
    case 'loss':
      return {
        name: 'Left on the table', nameTone: 'ink', figure: o.atStake, figureTone: 'red', signed: false, caption: null,
        sentence: `${fmtMoney(o.atStake)} comes out of your paycheck on this deal. The customer saves ${fmtMoney(r.customerSavesAnnual)} a year — you’re paying for part of it.`,
        figureText: fmtMoney(o.atStake),
      };
    case 'past':
      return {
        name: 'Line held.', nameTone: 'green', figure: r.commissionEffective, figureTone: 'ink', signed: false,
        caption: `accelerated · ${effectiveRateLabel(plan, r)}`,
        sentence: retro
          ? `You’re past your accelerator. Every deal this ${noun}, including this one, pays ${bump} more.`
          : `You’re past your accelerator. Every deal this ${noun}, including this one, earns ${accelRate}.`,
        figureText: fmtMoney(r.commissionEffective),
      };
    case 'held': {
      const opener = r.hasDiscount
        ? 'Full commission, full credit — that discount costs you nothing on this plan.'
        : 'Full price, full credit.';
      const lands = `This lands the ${noun} at ${fmtCredit(plan, r.creditAfter)}`;
      const toGo = fmtCredit(plan, Math.max(0, plan.accelerator_threshold - r.creditAfter));
      const sentence =
        plan.accelerator_style === 'none'
          ? `${opener} ${lands} of ${fmtCredit(plan, plan.quota)}.`
          : retro
            ? `${opener} ${lands} — ${toGo} more unlocks ${fmtSigned(r.crossingWorth)} on deals you’ve already closed.`
            : `${opener} ${lands} — ${toGo} more and every deal after that earns ${accelRate}.`;
      return {
        name: 'Line held.', nameTone: 'green', figure: r.commissionEffective, figureTone: 'ink', signed: false,
        caption: `is what this deal pays you · ${effectiveRateLabel(plan, r)}`,
        sentence, figureText: fmtMoney(r.commissionEffective),
      };
    }
  }
}

/** Caption under the promoted slider: "5% off = $55 a month off · the customer saves $660 a year". */
export function sliderCaption(deal: DealInput, r: CalcResult): string {
  const d = deal.subscriptionDiscountPct;
  if (d <= 0) return 'Full price';
  return `${fmtPctShort(d)} off = ${fmtMoney((r.subMrrList * d) / 100)} a month off · the customer saves ${fmtMoney((r.subAnnualList * d) / 100)} a year`;
}

/** One line under the one-time / implementation pair. */
export function oneTimeCopy(plan: CompPlan, deal: DealInput, otCost: number, implCost: number): string {
  if (plan.commission_style !== 'percent' || (plan.one_time_weight === 0 && plan.implementation_weight === 0)) {
    return 'Discounts here cost you nothing on this plan.';
  }
  const parts: string[] = [];
  if (deal.oneTimeDiscountPct > 0) parts.push(`${fmtPctShort(deal.oneTimeDiscountPct)} off the one-time products costs you ${fmtMoney(otCost)}.`);
  if (deal.implementationDiscountPct > 0) parts.push(`${fmtPctShort(deal.implementationDiscountPct)} off implementation costs you ${fmtMoney(implCost)}.`);
  if (parts.length) return parts.join(' ');
  return `One-time products count at ${fmtPctShort(plan.one_time_weight)} and implementation at ${fmtPctShort(plan.implementation_weight)} toward your commission.`;
}

/** "$3,000 one-time · $1,100 a month × 3 units · 5% off" for the mobile disclosure. */
export function dealSummary(deal: DealInput): string {
  if (isEmpty(deal)) return 'Nothing yet';
  const parts: string[] = [];
  if (deal.oneTime > 0) parts.push(`${fmtMoney(deal.oneTime)} one-time`);
  if (deal.implementation > 0) parts.push(`${fmtMoney(deal.implementation)} implementation`);
  if (deal.subscription > 0) {
    parts.push(`${fmtMoney(deal.subscription)} ${deal.subMode === 'acv' ? 'a year' : 'a month'} × ${Math.max(1, Math.round(deal.units))} unit${deal.units === 1 ? '' : 's'}`);
  }
  if (deal.subscriptionDiscountPct > 0) parts.push(`${fmtPctShort(deal.subscriptionDiscountPct)} off`);
  return parts.join(' · ');
}

// ── The line ────────────────────────────────────────────────────────────────

export type LineModel = {
  /** All positions as fractions 0–1 of the track. */
  barW: number;
  ghostX: number;
  ghostW: number;
  ringX: number | null;
  quotaX: number | null;
  accelerated: boolean;
  crossed: boolean;
  marker: string;
  origin: string;
  quotaLabel: string | null;
  callout: { text: string; tone: 'red' | 'green' | 'dim' } | null;
};

function markerText(plan: CompPlan): string {
  const noun = periodNoun(plan);
  if (plan.accelerator_style === 'none') return `Quota · ${fmtCredit(plan, plan.quota)}`;
  const th = fmtCredit(plan, plan.accelerator_threshold);
  return plan.accelerator_style === 'retro_bump'
    ? `Accelerator · ${th} · +${fmtPctShort(plan.accelerator_rate)} on the ${noun}`
    : `Accelerator · ${th} · ${fmtRateShort(plan, plan.accelerator_rate)} from here`;
}

/**
 * Deal mode (`/`): the line starts at the booked figure, so the last mile is
 * the width of the page. The span depends on the plan, the booked position and
 * the deal's *list* value — never on the discount — so only the bar and the
 * ghost move while dragging. Opening state: ring 57.1%, bar 56.6%, ghost 59.5%.
 */
export function dealLine(plan: CompPlan, ptd: PeriodToDate, r: CalcResult): LineModel {
  const hasAccel = plan.accelerator_style !== 'none';
  const threshold = hasAccel ? plan.accelerator_threshold : plan.quota;
  const origin = ptd.creditBooked;
  const toMark = Math.max(threshold, plan.quota) - origin;
  const span = Math.max(toMark * 1.75, r.creditFull * 1.15, plan.quota * 0.1, 1);
  const x = (v: number) => clamp01((v - origin) / span);

  const barW = x(r.creditAfter);
  const fullEnd = x(origin + r.creditFull);
  const crossed = hasAccel && (r.crossesAccelerator || r.isAccelerated);
  const pct = plan.quota > 0 ? Math.round((origin / plan.quota) * 100) : 0;

  let callout: LineModel['callout'];
  if (hasAccel) {
    callout = r.discountBlocksAccelerator
      ? { text: `${fmtCredit(plan, threshold - r.creditAfter)} short`, tone: 'red' }
      : crossed
        ? { text: `Crossed by ${fmtCredit(plan, r.creditAfter - threshold)}`, tone: 'green' }
        : { text: `${fmtCredit(plan, threshold - r.creditAfter)} to go`, tone: 'dim' };
  } else {
    callout = r.attained
      ? { text: 'Quota made', tone: 'dim' }
      : { text: `${fmtCredit(plan, r.toQuota)} to quota`, tone: 'dim' };
  }

  return {
    barW,
    ghostX: barW,
    ghostW: Math.max(0, fullEnd - barW),
    ringX: hasAccel ? x(threshold) : null,
    quotaX: !hasAccel || plan.quota !== threshold ? x(plan.quota) : null,
    accelerated: r.isAccelerated,
    crossed,
    marker: markerText(plan),
    origin: `${fmtCredit(plan, origin)} booked · ${pct}% of quota`,
    quotaLabel: hasAccel && plan.quota !== threshold ? `Quota · ${fmtCredit(plan, plan.quota)}` : null,
    callout,
  };
}

/** Quarter mode (`/quota`): the same line drawn from zero. */
export function quarterLine(plan: CompPlan, ptd: PeriodToDate): LineModel {
  const s = periodSummary(plan, ptd);
  const hasAccel = plan.accelerator_style !== 'none';
  const threshold = hasAccel ? plan.accelerator_threshold : plan.quota;
  const span = Math.max(plan.quota, threshold, ptd.creditBooked, 1) * 1.08;
  const x = (v: number) => clamp01(v / span);

  const callout: LineModel['callout'] = hasAccel
    ? s.accelerated
      ? { text: 'Crossed', tone: 'green' }
      : { text: `${fmtCredit(plan, s.toAccelerator)} to go`, tone: 'dim' }
    : s.attained
      ? { text: 'Quota made', tone: 'dim' }
      : { text: `${fmtCredit(plan, s.toQuota)} to quota`, tone: 'dim' };

  return {
    barW: x(ptd.creditBooked),
    ghostX: 0,
    ghostW: 0,
    ringX: hasAccel ? x(threshold) : null,
    quotaX: !hasAccel || plan.quota !== threshold ? x(plan.quota) : null,
    accelerated: s.accelerated,
    crossed: s.accelerated,
    marker: markerText(plan),
    origin: fmtCredit(plan, 0),
    quotaLabel: hasAccel && plan.quota !== threshold ? `Quota · ${fmtCredit(plan, plan.quota)}` : null,
    callout,
  };
}
