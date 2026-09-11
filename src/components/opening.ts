/**
 * The opening state, the outcome model and the copy — pure helpers shared by
 * the stage, the quota page and the OG image. No React in here.
 *
 * The one seam to know about: `calc().lost` compares discounted commission
 * with full-price commission at the *discounted* deal's accelerator state.
 * The stage measures against the deal as it would actually pay, via a
 * full-price twin: `atStake` and `lostOnDeal`. Booked rows keep the
 * engine's per-deal figure. Do not "fix" this in calc.ts.
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
  oneTime: 0, subscription: 0, subMode: 'mrr', units: 1,
  oneTimeDiscountPct: 0, subscriptionDiscountPct: 0,
};

/**
 * The seeded deal: 2 units, $800 MRR, $1,500 one-time (hardware/setup) at
 * 20% off. Landing this deal is what pushes the rep from 6 to 8 units —
 * exactly the monthly accelerator threshold — so it crosses on its own,
 * at the accelerated rate, the moment it's booked. The 20% is deliberately
 * on the one-time side, not the subscription: one-time products count at
 * only 40% toward commission here, so a discount that looks steep to the
 * customer barely touches the rep's paycheck. That gap — a discount's
 * sticker cost vs. what it actually costs in commission — is the thing
 * worth noticing, and it only exists because the plan weights revenue
 * types differently. A flat single-metric plan has no such gap to find.
 */
export const SAMPLE: DealInput = {
  oneTime: 1500, subscription: 800, subMode: 'mrr', units: 2,
  oneTimeDiscountPct: 20, subscriptionDiscountPct: 0,
};

/**
 * Mirror of demo.ts's seeded month, used only for the pre-hydration frame
 * and the OG image. A dev-mode check compares it to the store after hydration.
 */
export const OPENING_PTD: PeriodToDate = { creditBooked: 6, commissionBooked: 2636.27, earnedBooked: 2636.27 };

export const isEmpty = (d: DealInput) => d.oneTime === 0 && d.subscription === 0;

export const atFullPrice = (d: DealInput): DealInput => ({
  ...d, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0,
});

export type DiscountKey = 'oneTimeDiscountPct' | 'subscriptionDiscountPct';

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

  // Room to raise: the steepest subscription discount that still crosses
  // the accelerator. Only meaningful for ARR-quota plans — a discount
  // shrinks the ARR this deal contributes toward the threshold. Units-basis
  // plans don't have this: a unit is a unit regardless of price, so
  // discount never changes whether you cross.
  let safeDiscountPct: number | null = null;
  if (plan.quota_basis === 'arr' && plan.accelerator_style !== 'none' && r.subMrrList > 0) {
    const roomDollars = plan.accelerator_threshold - ptd.creditBooked;
    const listAnnual = r.subMrrList * 12;
    // Only meaningful if full price would actually cross — otherwise no
    // discount level gets you there and "room" is a nonsense question.
    if (listAnnual >= roomDollars) {
      safeDiscountPct = Math.min(100, Math.max(0, round2(100 * (1 - roomDollars / listAnnual))));
    }
  }

  return { r, rFull, atStake, lostOnDeal, state, safeDiscountPct };
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

export type Secondary = {
  label: string;
  value: number;
  tone: Tone;
  signed: boolean;
  /** Defaults to money. Room-to-raise is a percent, not a dollar figure. */
  format?: (n: number) => string;
  /** Room to Raise lives here, not buried in the sentence — a small line
   *  under the figure, same idiom as the primary figure's own caption. */
  caption?: string;
};

export type OutcomeCopy = {
  /** Always "Commission on this deal" once a deal exists — the headline
   *  figure is never swapped for a derived number, so the label never has
   *  to change to keep matching it. */
  name: string;
  /** Colour of the h2: green in every accelerated state, ink otherwise. */
  nameTone: 'green' | 'ink';
  figure: number | null;
  figureTone: Tone;
  signed: boolean;
  caption: string | null;
  /** The "Hold the Line" moment: what a discount is costing you, or what
   *  crossing the accelerator just unlocked. Shown next to the commission
   *  figure, not instead of it. */
  secondary: Secondary | null;
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
  const onlySub = deal.subscriptionDiscountPct > 0 && deal.oneTimeDiscountPct === 0;
  const onlyOneTime = deal.oneTimeDiscountPct > 0 && deal.subscriptionDiscountPct === 0;
  const weighted = plan.commission_style === 'percent' && plan.one_time_weight < 100;
  const residual =
    o.atStake > 0
      ? onlySub
        ? ` The ${pct} discount still costs you ${fmtMoney(o.atStake)} on this deal.`
        : onlyOneTime && weighted
          ? // The gap between what a discount looks like to the customer and
            // what it actually costs in commission only exists because this
            // plan weights revenue types differently — worth naming, not
            // just totaling.
            ` The ${fmtPctShort(deal.oneTimeDiscountPct)} off one-time products only costs you ${fmtMoney(o.atStake)} — they count at just ${fmtPctShort(plan.one_time_weight)} toward commission.`
          : ` Your discounts still cost you ${fmtMoney(o.atStake)} on this deal.`
      : '';

  if (o.state === 'empty') {
    return {
      name: 'Hold the line', nameTone: 'ink', figure: null, figureTone: 'ink', signed: false, caption: null,
      secondary: null, sentence: 'Enter what you’re selling and this fills itself in.', figureText: '',
    };
  }

  // Every other state shares the same primary block — what this deal pays,
  // right now — so the label and caption never have to be re-derived per
  // state, only the tone (accelerated → green) and the secondary callout.
  const accelerated = r.isAccelerated;
  const base = {
    name: 'Commission on this deal',
    nameTone: (accelerated ? 'green' : 'ink') as 'green' | 'ink',
    figure: r.commissionEffective,
    figureTone: (accelerated ? 'green' : 'ink') as Tone,
    signed: false,
    caption: `at ${effectiveRateLabel(plan, r)}${accelerated ? ', accelerated' : ''}`,
    figureText: fmtMoney(r.commissionEffective),
  };

  // The one lever a rep can actually act on: how far the discount could go
  // and still cross. Only computed for ARR-quota plans (see outcome()).
  // Lives as a caption UNDER the secondary figure — not appended to the
  // sentence, where it previously read as one more clause in an already
  // long paragraph and was easy to miss entirely. Two tones for the same
  // number: a warning once you're already over the line (blocked),
  // reassurance about the room you still have once you're not (crossed) —
  // never "held", where by construction this deal's price was never going
  // to decide whether the accelerator fires either way.
  const safePct = o.safeDiscountPct !== null ? fmtPctShort(o.safeDiscountPct) : null;
  const safeCaptionBlocked = safePct !== null ? `keep it under ${safePct} to still cross` : undefined;
  const safeCaptionCrossed = safePct !== null ? `room to discount up to ${safePct} and still cross` : undefined;

  switch (o.state) {
    case 'blocked':
      // The threshold, the rate, and the dollar breakdown are all already
      // visible as labeled figures elsewhere on the page (the accelerator
      // line, this secondary figure, its caption) — the sentence only needs
      // to name the mechanism, not re-derive numbers a second time.
      return {
        ...base,
        secondary: { label: 'Left on the table', value: o.atStake, tone: 'red', signed: false, caption: safeCaptionBlocked },
        sentence: retro
          ? `A ${pct} discount is what's keeping this under your accelerator — crossing it would raise pay on every deal you've already closed this ${noun}.`
          : `A ${pct} discount is what's keeping this under your accelerator — crossing it would raise pay on every deal after this one.`,
      };
    case 'crossed':
      return retro
        ? {
            ...base,
            secondary: {
              label: 'Unlocked on deals you already closed',
              value: r.retroBump,
              tone: 'green',
              signed: true,
              caption: safeCaptionCrossed,
            },
            sentence: `This deal crosses ${th} — every deal you’ve closed this ${noun} now pays ${bump} more.${residual}`,
          }
        : {
            ...base,
            // No dollar figure to pair with a caption here (no retro bump
            // to report), so room-to-raise gets its own small secondary —
            // the percent itself is the figure, not a caption under one.
            secondary:
              o.safeDiscountPct !== null
                ? { label: 'Room to discount and still cross', value: o.safeDiscountPct, tone: 'ink', signed: false, format: fmtPctShort }
                : null,
            sentence: `This deal triggers your accelerator. Every deal after this one earns ${accelRate}.${residual}`,
          };
    case 'loss':
      return {
        ...base,
        secondary: { label: 'Left on the table', value: o.atStake, tone: 'red', signed: false },
        // atStake is already the secondary figure above — no need to say
        // the dollar amount twice.
        sentence: `The customer saves ${fmtMoney(r.customerSavesAnnual)} a year — you’re paying for part of it.`,
      };
    case 'past':
      return {
        ...base,
        secondary: null,
        sentence: retro
          ? `You’re past your accelerator. Every deal this ${noun}, including this one, pays ${bump} more.`
          : `You’re past your accelerator. Every deal this ${noun}, including this one, earns ${accelRate}.`,
      };
    case 'held': {
      const opener = r.hasDiscount
        ? 'Full commission, full credit — that discount costs you nothing on this plan.'
        : 'Full price, full credit.';
      const lands = `This lands the ${noun} at ${fmtCredit(plan, r.creditAfter)}`;
      const toGo = fmtCredit(plan, Math.max(0, plan.accelerator_threshold - r.creditAfter));
      // No safe-discount clause here: "held" means this deal's price was
      // never going to decide whether the accelerator fires (see
      // outcome()) — safeDiscountPct is always null in this state, by
      // construction, so there's nothing actionable to add.
      const sentence =
        plan.accelerator_style === 'none'
          ? `${opener} ${lands} of ${fmtCredit(plan, plan.quota)}.`
          : retro
            ? `${opener} ${lands} — ${toGo} more unlocks ${fmtSigned(r.crossingWorth)} on deals you’ve already closed.`
            : `${opener} ${lands} — ${toGo} more and every deal after that earns ${accelRate}.`;
      return { ...base, secondary: null, sentence };
    }
  }
}

/** Caption under the promoted slider: "5% off = $55 a month off · the customer saves $660 a year". */
export function sliderCaption(deal: DealInput, r: CalcResult): string {
  const d = deal.subscriptionDiscountPct;
  if (d <= 0) return 'Full price';
  return `${fmtPctShort(d)} off = ${fmtMoney((r.subMrrList * d) / 100)} a month off · the customer saves ${fmtMoney((r.subAnnualList * d) / 100)} a year`;
}

/** One line under the one-time products field. */
export function oneTimeCopy(plan: CompPlan, deal: DealInput, otCost: number): string {
  if (plan.commission_style !== 'percent' || plan.one_time_weight === 0) {
    return 'Discounts here cost you nothing on this plan.';
  }
  if (deal.oneTimeDiscountPct > 0) return `${fmtPctShort(deal.oneTimeDiscountPct)} off one-time products costs you ${fmtMoney(otCost)}.`;
  return `One-time products count at ${fmtPctShort(plan.one_time_weight)} toward your commission.`;
}

/** "$3,000 one-time · $1,100 a month × 3 units · 5% off" for the mobile disclosure. */
export function dealSummary(deal: DealInput): string {
  if (isEmpty(deal)) return 'Nothing yet';
  const parts: string[] = [];
  if (deal.oneTime > 0) parts.push(`${fmtMoney(deal.oneTime)} one-time`);
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
