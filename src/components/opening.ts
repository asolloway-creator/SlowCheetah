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
  acceleratorSteps,
  calc,
  paysHardware,
  DEMO_PTD,
  DEMO_QTD,
  isFixedTier,
  kickerTierAt,
  kickerTierValue,
  periodSummary,
  quarterlyKickerSummary,
  stepIndexAt,
  type AcceleratorStep,
  type CalcResult,
  type CompPlan,
  type DealInput,
  type PeriodToDate,
  type QuarterToDate,
  type QuarterlyKickerTier,
} from '@/lib/calc';
import { fmtCredit, fmtMoney, fmtPctShort, fmtRateShort, fmtSigned, periodNoun } from '@/lib/format';

export const EMPTY: DealInput = {
  oneTime: 0, subscription: 0, subMode: 'mrr', units: 1,
  oneTimeDiscountPct: 0, subscriptionDiscountPct: 0,
};

/**
 * The seeded deal: 2 units, $1,800 MRR, $5,400 one-time (hardware/setup)
 * at full price. Landing this deal is what pushes the rep from 6 to 8
 * units — exactly the monthly accelerator threshold — so it crosses on its
 * own, at the accelerated rate, the moment it's booked.
 *
 * No discount anywhere at the start: the landing card plays one story, the
 * subscription discount against the Quarterly Bonus line, and any cost on
 * screen has to be one that story caused. (It used to open with 20% off the
 * one-time products, which put a cost on the card at 0% off with nothing
 * visible causing it.)
 *
 * Sized (together with DEMO_PTD/DEMO_QTD in calc.ts) so a 50% subscription
 * discount drops quarterly SaaS attainment from ~106% to ~104% against
 * DEMO_PLAN's quarterly_kicker — the accelerator crossing above is
 * discount-invariant (units, not dollars), so that story stays untouched
 * while this one plays out underneath it. See DEMO_PLAN in calc.ts.
 *
 * 3x the original $600/$1,800 sizing — the sample's whole position moved by
 * the same factor (DEMO_PTD/DEMO_QTD and DEMO_PLAN's quarterly_kicker.target
 * in calc.ts) so every ratio this deal's math depends on lands exactly where
 * it was, just with bigger absolute dollars behind it.
 */
export const SAMPLE: DealInput = {
  oneTime: 5400, subscription: 1800, subMode: 'mrr', units: 2,
  oneTimeDiscountPct: 0, subscriptionDiscountPct: 0,
};

/** Where the sample's rep stands this month and this quarter (calc.ts). */
export const OPENING_PTD: PeriodToDate = DEMO_PTD;
export const OPENING_QTD: QuarterToDate = DEMO_QTD;

export const isEmpty = (d: DealInput) => d.oneTime === 0 && d.subscription === 0 && !((d.hardware ?? 0) > 0);

export const atFullPrice = (d: DealInput): DealInput => ({
  ...d, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0, ...(d.hardwareDiscountPct ? { hardwareDiscountPct: 0 } : {}),
});

export type DiscountKey = 'oneTimeDiscountPct' | 'subscriptionDiscountPct' | 'hardwareDiscountPct';

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
  // the accelerator step at stake, the highest one full price reaches past
  // where the period stands. Only meaningful for ARR-quota plans — a
  // discount shrinks the ARR this deal contributes toward the threshold.
  // Units-basis plans don't have this: a unit is a unit regardless of
  // price, so discount never changes whether you cross.
  let safeDiscountPct: number | null = null;
  if (plan.quota_basis === 'arr' && r.stepFull > r.stepBefore && r.subMrrList > 0) {
    const roomDollars = acceleratorSteps(plan)[r.stepFull].threshold - ptd.creditBooked;
    const listAnnual = r.subMrrList * 12;
    // Full price crosses it by construction, so listAnnual >= roomDollars.
    safeDiscountPct = Math.min(100, Math.max(0, round2(100 * (1 - roomDollars / listAnnual))));
  }

  return { r, rFull, atStake, lostOnDeal, state, safeDiscountPct };
}

export type Outcome = ReturnType<typeof outcome>;

/** What one discount costs the rep, in dollars, measured against the same deal without it. */
export function costOf(plan: CompPlan, deal: DealInput, ptd: PeriodToDate, key: DiscountKey): number {
  if (!((deal[key] ?? 0) > 0)) return 0;
  const without = calc(plan, { ...deal, [key]: 0 }, ptd);
  return round2(without.totalPayoutImpact - calc(plan, deal, ptd).totalPayoutImpact);
}

/** "2 months of MRR" · "2.5 months of MRR" once a retro bump applies · "10.5%". */
export function effectiveRateLabel(plan: CompPlan, r: CalcResult): string {
  if (plan.accelerator_style === 'retro_bump' && r.isAccelerated) {
    return fmtRateShort(plan, round2(plan.base_rate * (1 + acceleratorSteps(plan)[r.step].rate / 100)));
  }
  return fmtRateShort(plan, r.effectiveRate);
}

// ── Quarterly kicker cross-effect ───────────────────────────────────────────
//
// Independent of the plan's own accelerator (outcome/outcomeCopy above) —
// this deal can cross the accelerator and cost a quarterly tier in the same
// breath, and the two can disagree. Sibling functions, not a change to
// outcome()/outcomeCopy(): the two existing call sites of those stay exactly
// as they were, and a plan with no quarterly_kicker never touches this code
// path at all.

export type CrossEffect = {
  tierAtFull: QuarterlyKickerTier | null;
  tierAtActual: QuarterlyKickerTier | null;
  /** The tier reached from booked deals alone, before this deal — lets the
   *  copy layer tell "this deal is what unlocks it" apart from "it was
   *  already secured regardless of this deal." */
  tierAtBooked: QuarterlyKickerTier | null;
  costsATier: boolean;
  /** costsATier: what the lost tier is worth over the one still held (the
   *  lost % on the whole quarter's SaaS commission, or a fixed bonus).
   *  Otherwise, when tierAtActual is held: what that tier is actually worth
   *  right now, the "what you're getting" figure for the positive case.
   *  Zero when neither applies. */
  value: number;
};

/**
 * Discounting can only ever cost a tier, never gain one — ARR credit is
 * monotonically non-increasing in discount, so tierAtActual can never
 * outrank tierAtFull. That's why costsATier is a boolean, not a 3-way
 * gained/lost/unchanged result: the "gained" branch is unreachable from
 * any real input.
 */
export function crossEffect(plan: CompPlan, o: Outcome, qtd: QuarterToDate): CrossEffect | null {
  const kicker = plan.quarterly_kicker;
  if (!kicker) return null;
  const { r, rFull } = o;
  const tierAtActual = kickerTierAt(kicker, qtd.saasArrBooked + r.subAnnual);
  const tierAtFull = kickerTierAt(kicker, qtd.saasArrBooked + rFull.subAnnual);
  const tierAtBooked = kickerTierAt(kicker, qtd.saasArrBooked);
  // A tier is lost when full price reaches a higher one than the discount
  // does; tiers rank by attainment, whatever each one pays.
  const costsATier = tierAtFull !== null && (tierAtActual === null || tierAtFull.attainmentPct > tierAtActual.attainmentPct);
  const saasBase = qtd.saasCommissionBooked + r.saasCommissionEffective;
  const held = kickerTierValue(tierAtActual, saasBase);
  const value = costsATier ? round2(Math.max(0, kickerTierValue(tierAtFull, saasBase) - held)) : round2(held);
  return { tierAtFull, tierAtActual, tierAtBooked, costsATier, value };
}

/**
 * The exact subscriptionDiscountPct at which this deal drops out of the
 * kicker tier it would otherwise hold at full price — solved in closed
 * form, the same room/listAnnual algebra outcome() already uses for
 * safeDiscountPct above, just measured against the kicker's tier target
 * instead of the accelerator threshold. subAnnual (all the kicker math
 * reads) is a strictly linear function of subscriptionDiscountPct alone,
 * so this is a fixed point given the deal's size and the quarter's
 * booked ARR — it never moves while a live slider drags across it, only
 * when the deal or the quarter's own numbers change.
 *
 * Only ever used to POSITION a marker — never to decide whether this
 * deal currently costs the tier, which stays crossEffect's own
 * costsATier at the live discount. Two independently-derived answers to
 * "did we cross" is exactly the kind of thing that can drift out of
 * sync; this function only ever answers "where," not "whether."
 */
export function kickerCrossDiscountPct(plan: CompPlan, o: Outcome, qtd: QuarterToDate | null): number | null {
  const kicker = plan.quarterly_kicker;
  if (!kicker || !qtd) return null;
  const listAnnual = o.rFull.subMrrList * 12;
  if (listAnnual <= 0) return null;
  const x = crossEffect(plan, o, qtd);
  if (!x?.tierAtFull) return null;
  // Already secured by booked deals alone — this deal isn't what decides
  // it, at any discount, so there's no breakpoint to mark.
  if (x.tierAtBooked && x.tierAtBooked.attainmentPct >= x.tierAtFull.attainmentPct) return null;
  const requiredArr = (kicker.target * x.tierAtFull.attainmentPct) / 100;
  const roomDollars = requiredArr - qtd.saasArrBooked;
  if (roomDollars <= 0) return null;
  return Math.min(100, Math.max(0, round2(100 * (1 - roomDollars / listAnnual))));
}

/**
 * "Hold the line": the steepest subscription discount, on the slider's own
 * half-point steps, that still keeps what this discount is costing. The
 * quarterly bonus tier when that's what's being lost, otherwise the
 * accelerator the discount is keeping the deal under. Null when the
 * discount isn't past either line. It's where the slider's prompt moves
 * back to, so the fix is the most the customer can still get, not 0%.
 *
 * Starts from the closed-form line and confirms against the engine itself
 * (crossEffect / outcome state), stepping down if rounding left it a hair
 * on the wrong side, so the spot it lands on can never still read as lost.
 */
export function holdLinePct(plan: CompPlan, deal: DealInput, ptd: PeriodToDate, qtd: QuarterToDate | null): number | null {
  const at = (pct: number) => outcome(plan, { ...deal, subscriptionDiscountPct: pct }, ptd);
  const step = (x: number) => Math.floor(x * 2 + 1e-9) / 2;
  const o = at(deal.subscriptionDiscountPct);
  if (qtd && crossEffect(plan, o, qtd)?.costsATier) {
    const kx = kickerCrossDiscountPct(plan, o, qtd);
    if (kx === null) return null;
    let p = Math.min(step(kx), deal.subscriptionDiscountPct);
    while (p > 0 && crossEffect(plan, at(p), qtd)?.costsATier) p -= 0.5;
    return Math.max(0, p);
  }
  if (o.state === 'blocked' && o.safeDiscountPct !== null) {
    let p = Math.min(step(o.safeDiscountPct), deal.subscriptionDiscountPct);
    while (p > 0 && at(p).state === 'blocked') p -= 0.5;
    return Math.max(0, p);
  }
  return null;
}

/** "Tier 1"/"Tier 2" is engine language — nobody talks about their comp
 *  plan that way. One name for each of the two fixed tiers, shared by the
 *  deal page and the /plan form so they never disagree with each other. */
export const tierName = (num: number) => (num === 1 ? 'Quarterly Bonus' : 'Quarterly Bonus (Stretch)');

/**
 * Red is the moment worth stopping for — full card, figure, mechanism, and
 * a short grounding clause (where the quarter already stood before this
 * deal), so "below 105%" doesn't read as invented. Green is a fact worth
 * confirming, not a warning — one quiet line, no card, no sentence: a
 * confirmation doesn't need the same visual weight as an alarm, and giving
 * it that weight is part of why the page read as noisy even on good news.
 */
export type KickerOutcomeCopy =
  | { tone: 'red'; label: string; value: number; sentence: string }
  | { tone: 'green'; label: string; value: number };

/**
 * Silent (null) unless this deal actually moves the needle — never a
 * permanently-visible box, same "give it its own home only when it
 * matters" precedent as Secondary.caption below. Red and green share one
 * home because they're the same event (a deal's effect on the quarterly
 * bonus), not two features — mirrors how the accelerator line itself
 * always shows exactly one of "crossed" / "short" / "blocked", never
 * silence once a deal exists.
 *
 * No comparison to this deal's own commission in the red sentence on
 * purpose — that figure is already the giant "Commission on this deal"
 * headline right below this card. Restating it was both redundant (same
 * number, third time on screen) and read as contradicting the *different*
 * "your discounts cost you $X" figure a few lines further down (that one's
 * atStake — commission lost to the discount, not commission earned — a
 * distinction the parenthetical never made). The red-vs-green figures
 * sitting right next to each other already make the stakes visible; the
 * sentence's job is the mechanism, not another number.
 */
export function kickerOutcomeCopy(plan: CompPlan, x: CrossEffect | null, qtd: QuarterToDate | null): KickerOutcomeCopy | null {
  const kicker = plan.quarterly_kicker;
  if (!x || !kicker) return null;
  const sorted = [...kicker.tiers].sort((a, b) => a.attainmentPct - b.attainmentPct);
  const numOf = (t: QuarterlyKickerTier) => sorted.findIndex((s) => s.attainmentPct === t.attainmentPct) + 1;
  const bookedPct = qtd && kicker.target > 0 ? (qtd.saasArrBooked / kicker.target) * 100 : null;

  if (x.costsATier) {
    const lost = x.tierAtFull!;
    const name = tierName(numOf(lost));
    const grounding = bookedPct !== null ? ` You're at ${fmtPctShort(bookedPct)} booked this quarter already.` : '';
    return {
      tone: 'red',
      label: `This deal costs you your ${name}`,
      value: x.value,
      sentence: isFixedTier(lost)
        ? `Dropping below ${fmtPctShort(lost.attainmentPct)} of your quarterly target loses it.${grounding}`
        : `Dropping below ${fmtPctShort(lost.attainmentPct)} quarterly SaaS attainment loses it, across the whole quarter's SaaS commission.${grounding}`,
    };
  }

  if (x.tierAtActual) {
    const name = tierName(numOf(x.tierAtActual));
    // Only credit the deal for a tier it actually decided — if booked
    // deals alone already cleared it, this deal isn't why it's there.
    const causedByDeal = !x.tierAtBooked || x.tierAtBooked.attainmentPct < x.tierAtActual.attainmentPct;
    return {
      tone: 'green',
      label: causedByDeal ? `This deal unlocks your ${name}` : `Your ${name} stays locked in`,
      value: x.value,
    };
  }

  return null;
}

/**
 * The full booked-quarter breakdown — was KickerStatus's entire job before
 * it merged into kickerOutcomeCopy above. Now lives only in the "See the
 * math" disclosure: the short groundingCaption on the red card covers the
 * default read, this is for whoever wants the exact numbers.
 */
export function kickerGroundingDetail(plan: CompPlan, qtd: QuarterToDate | null): string | null {
  const kicker = plan.quarterly_kicker;
  if (!kicker || !qtd) return null;
  const s = quarterlyKickerSummary(plan, qtd);
  if (!s) return null;
  const sorted = [...kicker.tiers].sort((a, b) => a.attainmentPct - b.attainmentPct);
  const numOf = (t: QuarterlyKickerTier) => sorted.findIndex((x) => x.attainmentPct === t.attainmentPct) + 1;
  const tail = s.tier
    ? ` · ${tierName(numOf(s.tier))} locked in: ${isFixedTier(s.tier) ? fmtMoney(s.bumpValue) : `+${fmtPctShort(s.tier.kickerPct)} on the quarter`}`
    : s.nextTier
      ? ` · ${fmtMoney(s.toNextTierArr)} to ${tierName(numOf(s.nextTier))} (${fmtPctShort(s.nextTier.attainmentPct)})`
      : '';
  return `Already booked this quarter: ${fmtMoney(qtd.saasArrBooked)} of ${fmtMoney(kicker.target)} (${fmtPctShort(s.attainmentPct)})${tail}`;
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
  /** The discount-cost breakdown — one-time vs. subscription, what it
   *  costs on this deal specifically. True and worth having, but not
   *  worth forcing into the default read every time: lives in the "See
   *  the math" disclosure, not inline in `sentence`. Null wherever the
   *  original sentence never had a residual clause to begin with. */
  detail: string | null;
  /** Plain text for the live region and the pinned bar. */
  figureText: string;
};

export function outcomeCopy(plan: CompPlan, deal: DealInput, o: Outcome, ptd: PeriodToDate): OutcomeCopy {
  const { r } = o;
  const noun = periodNoun(plan);
  const retro = plan.accelerator_style === 'retro_bump';
  // The step each state is about: the one this deal reaches, or (blocked)
  // the one full price would reach, or (held, past) the next one up. A
  // plan with one step only ever talks about "your accelerator".
  const steps = acceleratorSteps(plan);
  const stepAt = (i: number) => steps[Math.max(0, Math.min(i, steps.length - 1))] ?? { threshold: plan.accelerator_threshold, rate: plan.accelerator_rate };
  const named = (i: number) => (steps.length > 1 && i > 0 ? 'your next accelerator step' : 'your accelerator');
  const th = fmtCredit(plan, stepAt(r.step).threshold);
  const bump = `${fmtPctShort(stepAt(r.step).rate)}`;
  const accelRate = fmtRateShort(plan, stepAt(r.step).rate);
  const nextStep: AcceleratorStep | null = steps[r.step + 1] ?? null;
  const pct = fmtPctShort(deal.subscriptionDiscountPct);
  // A hardware discount is a third lever; with it in play the breakdown
  // falls back to the plain total.
  const hwOff = (deal.hardware ?? 0) > 0 && (deal.hardwareDiscountPct ?? 0) > 0;
  const onlySub = deal.subscriptionDiscountPct > 0 && deal.oneTimeDiscountPct === 0 && !hwOff;
  const onlyOneTime = deal.oneTimeDiscountPct > 0 && deal.subscriptionDiscountPct === 0 && !hwOff;
  const bothDiscounted = deal.subscriptionDiscountPct > 0 && deal.oneTimeDiscountPct > 0 && !hwOff;
  const weighted = plan.commission_style === 'percent' && plan.one_time_weight < 100;
  // Discount-cost breakdown — moved out of the always-read sentence and
  // into OutcomeCopy.detail (the "See the math" disclosure). No leading
  // space here (that was for inline concatenation, which detail doesn't need).
  const residual =
    o.atStake > 0
      ? onlySub
        ? `The ${pct} discount still costs you ${fmtMoney(o.atStake)} on this deal.`
        : onlyOneTime && weighted
          ? // The gap between what a discount looks like to the customer and
            // what it actually costs in commission only exists because this
            // plan weights revenue types differently — worth naming, not
            // just totaling.
            `The ${fmtPctShort(deal.oneTimeDiscountPct)} off one-time products only costs you ${fmtMoney(o.atStake)}. They count at just ${fmtPctShort(plan.one_time_weight)} toward commission.`
          : bothDiscounted && weighted
            ? // Both levers active: the one-time-weighting insight is still
              // true and still worth naming, not just swallowed into one
              // generic total the moment a second discount joins it.
              `Your discounts cost you ${fmtMoney(o.atStake)} on this deal. The one-time products alone are still just ${fmtMoney(costOf(plan, deal, ptd, 'oneTimeDiscountPct'))}, weighted at ${fmtPctShort(plan.one_time_weight)} toward commission.`
            : `Your discounts still cost you ${fmtMoney(o.atStake)} on this deal.`
      : null;

  if (o.state === 'empty') {
    return {
      name: 'Hold the line', nameTone: 'ink', figure: null, figureTone: 'ink', signed: false, caption: null,
      secondary: null, sentence: 'Enter what you’re selling and this fills itself in.', detail: null, figureText: '',
    };
  }

  // Every other state shares the same primary block — what this deal pays,
  // right now — so the label and caption never have to be re-derived per
  // state, only the tone (accelerated → green) and the secondary callout.
  const accelerated = r.isAccelerated;
  // The commission figure is a rate applied to a base — that multiplication
  // was previously invisible, living only in a same-named Ledger row far
  // below with nothing connecting the two. Naming the base right here, at
  // the point it matters, replaces that row instead of duplicating it.
  const rateLabel = `${effectiveRateLabel(plan, r)}${accelerated ? ', accelerated' : ''}`;
  const base = {
    name: 'Commission on this deal',
    nameTone: (accelerated ? 'green' : 'ink') as 'green' | 'ink',
    figure: r.commissionEffective,
    figureTone: (accelerated ? 'green' : 'ink') as Tone,
    signed: false,
    caption:
      (plan.commission_style === 'percent' ? `${fmtMoney(r.commissionable)} commissionable · ${rateLabel}` : `at ${rateLabel}`) +
      (r.hardwareCommission > 0 ? ` · plus ${fmtMoney(r.hardwareCommission)} on hardware` : ''),
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
    case 'blocked': {
      // The threshold, the rate, and the dollar breakdown are all already
      // visible as labeled figures elsewhere on the page (the accelerator
      // line, this secondary figure, its caption) — the sentence only needs
      // to name the mechanism, not re-derive numbers a second time.
      const under = named(r.stepFull);
      const to = steps.length > 1 && !retro ? `to ${fmtRateShort(plan, stepAt(r.stepFull).rate)} ` : '';
      return {
        ...base,
        secondary: { label: 'Left on the table', value: o.atStake, tone: 'red', signed: false, caption: safeCaptionBlocked },
        sentence: retro
          ? `A ${pct} discount is what's keeping this under ${under}. Crossing it would raise pay on every deal you've already closed this ${noun}.`
          : `A ${pct} discount is what's keeping this under ${under}. Crossing it would raise pay ${to}on every deal after this one.`,
        detail: null,
      };
    }
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
            sentence: `This deal crosses ${th}, so every deal you’ve closed this ${noun} now pays ${bump} more.`,
            detail: residual,
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
            sentence:
              r.step > 0
                ? `This deal reaches your next accelerator step. Every deal after this one earns ${accelRate}.`
                : `This deal triggers your accelerator. Every deal after this one earns ${accelRate}.`,
            detail: residual,
          };
    case 'loss':
      return {
        ...base,
        secondary: { label: 'Left on the table', value: o.atStake, tone: 'red', signed: false },
        // atStake is already the secondary figure above — no need to say
        // the dollar amount twice.
        sentence: `The customer saves ${fmtMoney(r.customerSavesAnnual)} a year, and you’re paying for part of it.`,
        detail: null,
      };
    case 'past': {
      const toNext = nextStep ? fmtCredit(plan, Math.max(0, nextStep.threshold - r.creditAfter)) : '';
      return {
        ...base,
        secondary: null,
        sentence: retro
          ? `You’re past your accelerator. Every deal this ${noun}, including this one, pays ${bump} more.${
              nextStep ? ` Another ${toNext} makes it ${fmtPctShort(nextStep.rate)}.` : ''
            }`
          : `You’re past your accelerator. Every deal this ${noun}, including this one, earns ${accelRate}.${
              nextStep ? ` Another ${toNext} and every deal after that earns ${fmtRateShort(plan, nextStep.rate)}.` : ''
            }`,
        detail: null,
      };
    }
    case 'held': {
      const opener = r.hasDiscount
        ? 'That discount costs you nothing on this plan. Full commission, full credit.'
        : 'Full price, full credit.';
      const lands = `This lands the ${noun} at ${fmtCredit(plan, r.creditAfter)}`;
      const ahead = nextStep ?? stepAt(0);
      const toGo = fmtCredit(plan, Math.max(0, ahead.threshold - r.creditAfter));
      const aheadRate = fmtRateShort(plan, ahead.rate);
      // No safe-discount clause here: "held" means this deal's price was
      // never going to decide whether the accelerator fires (see
      // outcome()) — safeDiscountPct is always null in this state, by
      // construction, so there's nothing actionable to add.
      const sentence =
        plan.accelerator_style === 'none'
          ? `${opener} ${lands} of ${fmtCredit(plan, plan.quota)}.`
          : retro
            ? `${opener} ${lands}. Another ${toGo} unlocks ${fmtSigned(r.crossingWorth)} on deals you’ve already closed.`
            : `${opener} ${lands}. Another ${toGo} and every deal after that earns ${aheadRate}.`;
      return { ...base, secondary: null, sentence, detail: null };
    }
  }
}

/** Caption under the promoted slider: "5% off = $55 a month off · the customer saves $660 a year". */
export function sliderCaption(deal: DealInput, r: CalcResult): string {
  const d = deal.subscriptionDiscountPct;
  if (d <= 0) return 'Full price. Drag to see what it costs.';
  // "on the subscription alone" — the Ledger's Customer saves row totals
  // this together with the one-time discount, so without the qualifier
  // the two figures read as disagreeing rather than answering different
  // questions.
  return `${fmtPctShort(d)} off = ${fmtMoney((r.subMrrList * d) / 100)} a month off · saves the customer ${fmtMoney((r.subAnnualList * d) / 100)} a year on the subscription alone`;
}

/** One line under the one-time products field. */
export function oneTimeCopy(plan: CompPlan, deal: DealInput, otCost: number): string {
  const what = paysHardware(plan) ? 'Setup and services' : 'One-time products';
  if (plan.commission_style !== 'percent' || plan.one_time_weight === 0) {
    return 'Discounts here cost you nothing on this plan.';
  }
  if (deal.oneTimeDiscountPct > 0) return `${fmtPctShort(deal.oneTimeDiscountPct)} off ${what.toLowerCase()} costs you ${fmtMoney(otCost)}.`;
  return `${what} count at ${fmtPctShort(plan.one_time_weight)} toward your commission.`;
}

/** One line under the hardware field, on a plan that pays hardware its own rate. */
export function hardwareCopy(plan: CompPlan, deal: DealInput, hwCost: number): string {
  const rate = plan.hardware_rate ?? 0;
  if (rate === 0) return 'Hardware pays nothing on this plan, so discounts here cost you nothing.';
  if ((deal.hardwareDiscountPct ?? 0) > 0) return `${fmtPctShort(deal.hardwareDiscountPct as number)} off hardware costs you ${fmtMoney(hwCost)}.`;
  return `Hardware pays a flat ${fmtPctShort(rate)}, accelerator or not.`;
}

/** "$3,000 one-time · $1,100 a month × 3 units · 5% off" for the mobile disclosure. */
export function dealSummary(deal: DealInput): string {
  if (isEmpty(deal)) return 'Nothing yet';
  const parts: string[] = [];
  if (deal.oneTime > 0) parts.push(`${fmtMoney(deal.oneTime)} one-time`);
  if ((deal.hardware ?? 0) > 0) parts.push(`${fmtMoney(deal.hardware as number)} hardware`);
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
  /** The plan's other accelerator steps, on a plan with more than one. */
  stepXs: number[];
  quotaX: number | null;
  accelerated: boolean;
  crossed: boolean;
  marker: string;
  origin: string;
  quotaLabel: string | null;
  callout: { text: string; tone: 'red' | 'green' | 'dim' } | null;
};

function markerText(plan: CompPlan, step: AcceleratorStep | null): string {
  const noun = periodNoun(plan);
  if (!step) return `Quota · ${fmtCredit(plan, plan.quota)}`;
  const th = fmtCredit(plan, step.threshold);
  return plan.accelerator_style === 'retro_bump'
    ? `Accelerator · ${th} · +${fmtPctShort(step.rate)} on the ${noun}`
    : `Accelerator · ${th} · ${fmtRateShort(plan, step.rate)} from here`;
}

/** Where the line's other steps sit: every one but the ring's, on the track. */
function otherSteps(steps: AcceleratorStep[], ring: number, x: (v: number) => number): number[] {
  return steps.filter((_, i) => i !== ring).map((s) => x(s.threshold)).filter((v) => v > 0 && v < 1);
}

/**
 * Deal mode (`/`): the line starts at the booked figure, so the last mile is
 * the width of the page. The span depends on the plan, the booked position and
 * the deal's *list* value — never on the discount — so only the bar and the
 * ghost move while dragging. Opening state: ring 57.1%, bar 56.6%, ghost 59.5%.
 */
export function dealLine(plan: CompPlan, ptd: PeriodToDate, r: CalcResult, isEmptyDeal = false): LineModel {
  const steps = acceleratorSteps(plan);
  const hasAccel = steps.length > 0;
  const origin = ptd.creditBooked;
  // An empty deal still carries DealInput's field defaults (EMPTY.units is
  // 1, not 0 — a sensible starting point for the NumField, not a real
  // deal) — calc() has no way to know the difference, so left unguarded
  // this credits a phantom unit toward the line before anything's been
  // entered. Collapse back to "nothing in progress" here instead: origin
  // only, no crossing, no ghost, accelerated only if booked deals alone
  // already got there.
  const r2: CalcResult = isEmptyDeal
    ? {
        ...r,
        creditAfter: origin,
        creditFull: origin,
        crossesAccelerator: false,
        isAccelerated: r.wasAccelerated,
        step: r.stepBefore,
        stepFull: r.stepBefore,
        discountBlocksAccelerator: false,
        attained: ptd.creditBooked >= plan.quota,
        toQuota: Math.max(0, plan.quota - ptd.creditBooked),
      }
    : r;
  // The step in play gets the ring: the one a discount keeps this deal
  // under, or the one it crosses, else the next one up, else (past the
  // last) the last one. The rest are plain posts.
  const ring = !hasAccel
    ? -1
    : r2.discountBlocksAccelerator
      ? r2.stepFull
      : r2.crossesAccelerator
        ? r2.step
        : Math.min(r2.stepBefore + 1, steps.length - 1);
  const ringStep = ring >= 0 ? steps[ring] : null;
  const threshold = ringStep ? ringStep.threshold : plan.quota;
  const toMark = Math.max(threshold, plan.quota) - origin;
  // A deal that could plausibly close the gap gets the wide 1.75x scale —
  // that's the room "crossed by $X" needs past the ring, and it's what the
  // opening state is hand-tuned against (ring 57.1%, bar 56.6%, ghost
  // 59.5%). A deal too small to ever reach the threshold has no overshoot
  // to make room for; scaling to its own size instead of the full gap kept
  // stranding it in the first third of the track with the ring and a dead
  // gap floating past it. Tie the scale to the gap itself there.
  const creditFull = isEmptyDeal ? 0 : r2.creditFull;
  const canReach = creditFull >= toMark;
  const span = canReach
    ? Math.max(toMark * 1.75, creditFull * 1.15, plan.quota * 0.1, 1)
    : Math.max(toMark * 1.25, plan.quota * 0.1, 1);
  const x = (v: number) => clamp01((v - origin) / span);

  const barW = x(r2.creditAfter);
  const fullEnd = x(origin + creditFull);
  const crossed = ringStep !== null && r2.creditAfter >= ringStep.threshold;
  const pct = plan.quota > 0 ? Math.round((origin / plan.quota) * 100) : 0;

  let callout: LineModel['callout'];
  if (hasAccel) {
    callout = r2.discountBlocksAccelerator
      ? { text: `${fmtCredit(plan, threshold - r2.creditAfter)} short`, tone: 'red' }
      : crossed
        ? {
            text: r2.creditAfter > threshold ? `Crossed by ${fmtCredit(plan, r2.creditAfter - threshold)}` : 'Right on the line',
            tone: 'green',
          }
        : { text: `${fmtCredit(plan, threshold - r2.creditAfter)} to go`, tone: 'dim' };
  } else {
    callout = r2.attained
      ? { text: 'Quota made', tone: 'dim' }
      : { text: `${fmtCredit(plan, r2.toQuota)} to quota`, tone: 'dim' };
  }

  // The quota gets its own post only while it's still ahead on this line
  // (once behind, the origin label already says how far past it you are)
  // and isn't one of the accelerator steps, whose post marks it already.
  const quotaAhead = !hasAccel || (plan.quota > origin && !steps.some((st) => st.threshold === plan.quota));
  return {
    barW,
    ghostX: barW,
    ghostW: Math.max(0, fullEnd - barW),
    ringX: hasAccel ? x(threshold) : null,
    stepXs: otherSteps(steps, ring, x),
    quotaX: quotaAhead ? x(plan.quota) : null,
    accelerated: r2.isAccelerated,
    crossed,
    marker: markerText(plan, ringStep),
    origin: `${fmtCredit(plan, origin)} booked · ${pct}% of quota`,
    quotaLabel: hasAccel && quotaAhead ? `Quota · ${fmtCredit(plan, plan.quota)}` : null,
    callout,
  };
}

/** Quarter mode (`/quota`): the same line drawn from zero. */
export function quarterLine(plan: CompPlan, ptd: PeriodToDate): LineModel {
  const s = periodSummary(plan, ptd);
  const steps = acceleratorSteps(plan);
  const hasAccel = steps.length > 0;
  // The ring is on the next step up, or the last one once past them all.
  const ring = hasAccel ? Math.min(stepIndexAt(steps, ptd.creditBooked) + 1, steps.length - 1) : -1;
  const ringStep = ring >= 0 ? steps[ring] : null;
  const threshold = ringStep ? ringStep.threshold : plan.quota;
  const top = hasAccel ? steps[steps.length - 1].threshold : plan.quota;
  const span = Math.max(plan.quota, top, ptd.creditBooked, 1) * 1.08;
  const x = (v: number) => clamp01(v / span);
  const reached = ringStep !== null && ptd.creditBooked >= ringStep.threshold;
  // An accelerator step at the quota marks it already.
  const quotaOwnPost = !hasAccel || !steps.some((st) => st.threshold === plan.quota);

  const callout: LineModel['callout'] = hasAccel
    ? reached
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
    stepXs: otherSteps(steps, ring, x),
    quotaX: quotaOwnPost ? x(plan.quota) : null,
    accelerated: s.accelerated,
    crossed: reached,
    marker: markerText(plan, ringStep),
    origin: fmtCredit(plan, 0),
    quotaLabel: hasAccel && quotaOwnPost ? `Quota · ${fmtCredit(plan, plan.quota)}` : null,
    callout,
  };
}
