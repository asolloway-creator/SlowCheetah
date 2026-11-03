import { stepRatePct, type CompPlan } from '@/lib/calc';

/** Further accelerator steps, as ", 15% past $187,500" (calc.ts acceleratorSteps). */
const moreSteps = (p: CompPlan) =>
  (p.accelerator_steps ?? [])
    .map((s) => `, ${stepWords(p, s)} past ${fmtCredit(p, s.threshold)}`)
    .join('');

/** A step's pay as a rep reads it on a statement: the rate on a percent plan
 *  (a retro bump included, as the rate it lifts the base to), else "+25%". */
const stepWords = (p: CompPlan, s: { threshold: number; rate: number }) =>
  p.accelerator_style === 'retro_bump'
    ? p.commission_style === 'percent'
      ? fmtRatePct(stepRatePct(p, s))
      : `+${fmtPctShort(s.rate)}`
    : fmtRateShort(p, s.rate);

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = (n: number) => usd0.format(n);
export const fmtD = (n: number) => usd2.format(n);
export const fmtP = (n: number) => `${n.toFixed(1)}%`;
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** The unit the rep reads recurring revenue in (comp_plans.display_unit):
 *  MRR only on a plan whose quota is in ARR, since a units plan has neither. */
export const revUnit = (plan: CompPlan): 'arr' | 'mrr' => (plan.quota_basis === 'arr' && plan.display_unit === 'mrr' ? 'mrr' : 'arr');
/** "ARR" or "MRR", for the words around a number. */
export const revWord = (plan: CompPlan) => (revUnit(plan) === 'mrr' ? 'MRR' : 'ARR');
/** An ARR amount in the rep's unit: $59,220 or, as MRR, $4,935. Every stored
 *  number is ARR; this is the one place it turns into MRR. */
export const toRev = (plan: CompPlan, arr: number) => (revUnit(plan) === 'mrr' ? arr / 12 : arr);
export const fmtRev = (plan: CompPlan, arr: number) => fmt(toRev(plan, arr));

/** Quota credit in the plan's basis: "6 units", "$87,330", or "$7,278 MRR".
 *  ARR is the plan's own unit and reads bare; MRR always says so, so a
 *  monthly figure is never taken for an annual one. */
export const fmtCredit = (plan: CompPlan, n: number) =>
  plan.quota_basis === 'units'
    ? `${Math.round(n)} unit${Math.round(n) === 1 ? '' : 's'}`
    : revUnit(plan) === 'mrr'
      ? `${fmtRev(plan, n)} MRR`
      : fmt(n);

/** "8.5%" or "2 months of MRR". */
export const fmtRate = (plan: CompPlan, rate: number) =>
  plan.commission_style === 'percent' ? fmtP(rate) : `${rate} month${rate === 1 ? '' : 's'} of MRR`;

export const periodNoun = (plan: CompPlan) => (plan.period === 'quarter' ? 'quarter' : 'month');

// ── Additions for the rebuild (the helpers above are unchanged) ──────────────

/** Cents only when present: $2,750 · $4,298.75 · $82.50. Never "-$0". */
export const fmtMoney = (n: number) => {
  const c = Math.round(n * 100) / 100 || 0;
  return Number.isInteger(c) ? fmt(c) : fmtD(c);
};

/** +$3,638.75 · −$110 · $0 */
export const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtMoney(Math.abs(n))}`;

/** 5% · 4.5% */
export const fmtPctShort = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** A rate the plan sets, to the hundredth when it has one: "8.26%", "10%",
 *  "12.5%". Never rounded to a tenth, since 8.26% and 8.3% aren't the same plan. */
export const fmtRatePct = (n: number) => `${Number.isInteger(n) ? n : parseFloat(n.toFixed(2))}%`;

export const fmtPerMonth = (n: number) => `${fmtMoney(n)} a month`;

/** Like fmtRate, but "10%" rather than "10.0%" on percent plans. */
export const fmtRateShort = (plan: CompPlan, rate: number) =>
  plan.commission_style === 'percent' ? fmtRatePct(rate) : fmtRate(plan, rate);

/**
 * One-line plain-English shape of a plan, built from the plan itself so the
 * preset tiles and the OG alt text can never drift from the numbers:
 * "2 months of MRR per deal · +25% on the whole quarter once you cross $100,000"
 */
export function planSentence(p: CompPlan): string {
  const noun = periodNoun(p);
  const percent = p.commission_style === 'percent';
  const base = percent ? `${fmtRatePct(p.base_rate)} of deal value` : `${fmtRate(p, p.base_rate)} per deal`;
  const hardware = typeof p.hardware_rate === 'number' ? `hardware at a flat ${fmtRatePct(p.hardware_rate)}` : null;
  if (p.accelerator_style === 'none') return [`${base}, every deal, all ${noun} long`, hardware].filter(Boolean).join(' · ');

  const th = fmtCredit(p, p.accelerator_threshold);
  const accel =
    (p.accelerator_style === 'retro_bump'
      ? percent
        ? `${fmtRatePct(stepRatePct(p, { threshold: p.accelerator_threshold, rate: p.accelerator_rate }))} on every deal that ${noun} once you cross ${th}`
        : `+${fmtPctShort(p.accelerator_rate)} on the whole ${noun} once you cross ${th}`
      : `${fmtRateShort(p, p.accelerator_rate)} on every deal once ${p.quota_basis === 'units' ? `${th} land` : `you cross ${th}`}`) +
    moreSteps(p);

  let weights: string | null = null;
  if (percent && p.one_time_weight !== 100) {
    weights =
      p.one_time_weight === 0
        ? hardware
          ? 'one-time services don’t count'
          : 'subscription only'
        : `one-time services and equipment at ${fmtPctShort(p.one_time_weight)}`;
  }
  return [base, accel, weights, hardware].filter(Boolean).join(' · ');
}
