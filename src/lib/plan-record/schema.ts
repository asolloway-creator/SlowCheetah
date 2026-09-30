import * as z from 'zod/v4';
import { COMPANY_SIZE_BANDS } from '@/lib/calc';

/**
 * The plan record: everything a rep described about how they're paid, in a
 * fixed format with the numbers pulled out. Never their words, their
 * company, their deals or their exact pay. Two shapes live here:
 *
 *  - WireRead: what Claude fills in. Structured outputs allow only 16
 *    nullable fields per request, so "not given" is -1 for numbers and
 *    'unknown' for choices. Nothing is optional.
 *  - PlanRecord: what IOI keeps. Proper nulls, and provenance that also
 *    covers answers to follow-up questions and corrections.
 *
 * The record is deliberately wider than the pay engine (calc.ts). It keeps
 * caps, clawbacks, draws and multi-step accelerators even though IOI can't
 * calculate them yet, so plans collected today can be recalculated later
 * without asking anyone again. map.ts derives the calculable plan.
 */

export const FORMAT_VERSION = 1;

export const PERIODS = ['month', 'quarter', 'half', 'year', 'unknown'] as const;
export const MEASURES = [
  'new_arr', 'acv', 'first_year_value', 'mrr', 'tcv', 'bookings', 'revenue', 'gross_profit', 'units', 'deals', 'other', 'unknown',
] as const;
export const PAY_METHODS = [
  'percent_of_value', 'months_of_mrr', 'flat_per_unit', 'flat_per_deal', 'percent_of_margin', 'other', 'unknown',
] as const;
export const VALUE_BASES = [
  'arr', 'acv', 'first_year_value', 'mrr', 'tcv', 'revenue', 'margin', 'not_applicable', 'unknown',
] as const;
export const APPLIES_TO = ['all', 'new_business', 'expansion', 'renewal', 'recurring', 'one_time', 'other'] as const;
export const ACCEL_KINDS = ['forward_rate', 'retroactive_rate', 'retroactive_bump', 'marginal_tier', 'unknown'] as const;
export const FLOOR_KINDS = ['no_commission_below', 'reduced_rate_below'] as const;
export const DISCOUNT_EFFECTS = ['reduced_rate', 'no_commission', 'approval_only', 'other'] as const;
export const BONUS_KINDS = ['period_kicker', 'attainment_bonus', 'spiff', 'other'] as const;
export const SPIFF_FOR = ['product', 'multi_year', 'prepay', 'new_logo', 'activity', 'other', 'not_applicable'] as const;
export const CAP_KINDS = ['total_commission', 'per_deal', 'other'] as const;
export const DRAW_KINDS = ['recoverable', 'non_recoverable', 'unknown'] as const;
export const PAY_TIMING = ['booking', 'invoice', 'collection', 'go_live', 'other', 'unknown'] as const;
export const OTHER_FEATURES = [
  'ramp', 'deal_splits', 'multi_year_credit', 'team_bonus', 'mbo', 'territory_rules', 'overlay', 'renewal_rules', 'windfall', 'other',
] as const;
export const ROLE_LEVELS = ['sdr', 'ae', 'am', 'csm', 'se', 'manager', 'other', 'unknown'] as const;
export const INPUT_KINDS = ['plan', 'document', 'not_a_plan', 'too_vague'] as const;
export const READ_SOURCES = ['stated', 'assumed'] as const;
export const SOURCES = ['stated', 'assumed', 'answered', 'corrected'] as const;

export type Period = (typeof PERIODS)[number];
export type Measure = (typeof MEASURES)[number];
export type PayMethod = (typeof PAY_METHODS)[number];
export type ValueBasis = (typeof VALUE_BASES)[number];
export type AppliesTo = (typeof APPLIES_TO)[number];
export type AccelKind = (typeof ACCEL_KINDS)[number];
export type FloorKind = (typeof FLOOR_KINDS)[number];
export type DiscountEffect = (typeof DISCOUNT_EFFECTS)[number];
export type BonusKind = (typeof BONUS_KINDS)[number];
export type SpiffFor = (typeof SPIFF_FOR)[number];
export type CapKind = (typeof CAP_KINDS)[number];
export type DrawKind = (typeof DRAW_KINDS)[number];
export type PayTiming = (typeof PAY_TIMING)[number];
export type OtherFeature = (typeof OTHER_FEATURES)[number];
export type RoleLevel = (typeof ROLE_LEVELS)[number];
export type InputKind = (typeof INPUT_KINDS)[number];
export type Source = (typeof SOURCES)[number];

// ── Optional context, asked after a plan is confirmed ───────────────────────

export const SEGMENTS = [
  ['smb', 'SMB'],
  ['mid_market', 'Mid-market'],
  ['enterprise', 'Enterprise'],
  ['mixed', 'A mix'],
] as const;
export const TENURE_BANDS = [
  ['lt_1y', 'Under a year'],
  ['1_2y', '1 to 2 years'],
  ['2_4y', '2 to 4 years'],
  ['4y_plus', '4 years or more'],
] as const;
export const REGIONS = [
  ['us', 'In the US'],
  ['outside_us', 'Outside the US'],
] as const;
export const OTE_BANDS = [
  ['lt_100k', 'Under $100K'],
  ['100_150k', '$100K to $150K'],
  ['150_200k', '$150K to $200K'],
  ['200_250k', '$200K to $250K'],
  ['250_300k', '$250K to $300K'],
  ['300k_plus', '$300K or more'],
] as const;
export const CONTEXT_ROLE_LEVELS = [
  ['sdr', 'SDR or BDR'],
  ['ae', 'Account Executive'],
  ['am', 'Account Manager'],
  ['csm', 'Customer Success'],
  ['se', 'Sales Engineer'],
  ['manager', 'Sales manager'],
  ['other', 'Something else'],
] as const;
/** A fixed list, never free text: a typed "industry" is exactly where a
 *  company name would slip in. */
export const INDUSTRIES = [
  ['software', 'Software and SaaS'],
  ['fintech', 'Fintech and payments'],
  ['security', 'Cybersecurity'],
  ['devtools', 'Developer tools and infrastructure'],
  ['healthcare', 'Healthcare'],
  ['financial_services', 'Banking and financial services'],
  ['insurance', 'Insurance'],
  ['hospitality', 'Restaurants and hospitality'],
  ['retail', 'Retail and e-commerce'],
  ['manufacturing', 'Manufacturing'],
  ['logistics', 'Logistics and supply chain'],
  ['media', 'Media and advertising'],
  ['telecom', 'Telecom'],
  ['education', 'Education'],
  ['real_estate', 'Real estate'],
  ['services', 'Professional services'],
  ['hr', 'HR and staffing'],
  ['other', 'Something else'],
] as const;

const keysOf = <T extends readonly (readonly [string, string])[]>(pairs: T) =>
  pairs.map(([k]) => k) as unknown as [T[number][0], ...T[number][0][]];

export const PlanContext = z.object({
  role_level: z.enum(keysOf(CONTEXT_ROLE_LEVELS)).nullable(),
  segment: z.enum(keysOf(SEGMENTS)).nullable(),
  industry: z.enum(keysOf(INDUSTRIES)).nullable(),
  company_size_band: z.enum(keysOf(COMPANY_SIZE_BANDS as unknown as readonly (readonly [string, string])[])).nullable(),
  tenure_band: z.enum(keysOf(TENURE_BANDS)).nullable(),
  region: z.enum(keysOf(REGIONS)).nullable(),
  ote_band: z.enum(keysOf(OTE_BANDS)).nullable(),
});
export type PlanContext = z.infer<typeof PlanContext>;
export const EMPTY_CONTEXT: PlanContext = {
  role_level: null, segment: null, industry: null, company_size_band: null, tenure_band: null, region: null, ote_band: null,
};

// ── What Claude fills in ─────────────────────────────────────────────────────

const unknownNumber = (what: string) => z.number().describe(`${what} Use -1 when the description doesn't give it.`);
const readSource = z
  .enum(READ_SOURCES)
  .describe("'stated' when the person said it outright. 'assumed' when you inferred it from context or a common convention.");

export const WireRead = z.object({
  input_kind: z
    .enum(INPUT_KINDS)
    .describe(
      "'plan': a description of how someone is paid. 'document': text pasted from a formal plan document (legal or policy wording, section numbers, defined terms, confidentiality notices). 'not_a_plan': anything that isn't about sales pay. 'too_vague': about pay, but with almost nothing to go on.",
    ),
  role_level: z.enum(ROLE_LEVELS),
  role_title: z
    .string()
    .describe(
      'A generic job title only if they gave one, like "Senior AE" or "Enterprise Account Executive". Never a company, product, team or person name. Empty string if none.',
    ),
  quota: z.object({
    period: z.enum(PERIODS).describe('How often quota resets.'),
    measure: z
      .enum(MEASURES)
      .describe(
        "What counts toward quota. new_arr: new annual recurring revenue. acv: annual contract value. first_year_value: first-year contract value. mrr: monthly recurring revenue. tcv: total contract value across all years. bookings: 'bookings' with no further detail. units/deals: a count.",
      ),
    amount: unknownNumber('Quota for one period, in the measure: dollars for money measures, a count for units or deals.'),
    source: readSource,
  }),
  pay_rules: z
    .array(
      z.object({
        applies_to: z.enum(APPLIES_TO).describe("Which business the rule pays on. 'all' unless the plan pays different rates on different business."),
        method: z.enum(PAY_METHODS),
        value_basis: z
          .enum(VALUE_BASES)
          .describe("What a percent is taken of. 'not_applicable' for months of MRR and flat amounts."),
        rate: unknownNumber('The base rate: a percent as a number (7 for 7%), months of MRR as a number (2), or dollars for a flat amount.'),
        source: readSource,
      }),
    )
    .describe('How each deal pays before any accelerator. One entry per distinct rate.'),
  one_time_counts_pct: unknownNumber(
    'Percent of one-time charges (setup, services, hardware, implementation) that counts toward commission. 0 when commission is on subscription or ARR only. 100 when one-time charges pay at the full rate.',
  ),
  one_time_source: readSource,
  accelerators: z
    .array(
      z.object({
        kind: z
          .enum(ACCEL_KINDS)
          .describe(
            "forward_rate: once past the line, that deal and every deal after it earn a higher rate. retroactive_rate: once past the line, every deal in the period is repaid at the higher rate, earlier ones included. retroactive_bump: once past the line, all commission for the period gets a percent boost, earlier deals included. marginal_tier: only the portion of attainment above the line earns the higher rate. unknown: an accelerator is mentioned but not how it applies.",
          ),
        starts_at_pct: unknownNumber('Where it starts, as a percent of quota (100 for "at quota").'),
        starts_at_amount: unknownNumber('Where it starts as an amount in the quota measure, if stated that way.'),
        rate: unknownNumber(
          'For forward_rate, retroactive_rate and marginal_tier: the new rate in the same unit as the base rate (a multiplier like "2x" times the base rate). For retroactive_bump: the boost in percent (25 for +25%).',
        ),
        source: readSource,
      }),
    )
    .describe('Accelerators in order of where they start. Empty if none.'),
  floors: z
    .array(
      z.object({
        kind: z.enum(FLOOR_KINDS),
        below_pct: unknownNumber('Attainment percent below which the rule applies.'),
        rate: unknownNumber('The reduced rate, same unit as the base rate.'),
        source: readSource,
      }),
    )
    .describe('Rules that pay less, or nothing, below an attainment level. Empty if none.'),
  discount_rules: z
    .array(
      z.object({
        over_pct: unknownNumber('The discount percent above which the rule applies.'),
        effect: z.enum(DISCOUNT_EFFECTS),
        rate: unknownNumber('The reduced rate when effect is reduced_rate.'),
        source: readSource,
      }),
    )
    .describe('Rules that change pay when a deal is discounted past a point. Empty if none. Ordinary "commission is on the discounted price" is not a rule.'),
  bonuses: z
    .array(
      z.object({
        kind: z
          .enum(BONUS_KINDS)
          .describe(
            'period_kicker: a percent boost on a whole period\'s commission for crossing attainment levels. attainment_bonus: a fixed dollar bonus for reaching attainment levels. spiff: a bonus for selling a particular product or doing a particular thing.',
          ),
        period: z.enum(PERIODS),
        measure: z.enum(MEASURES).describe('What the bonus measures attainment on.'),
        target_amount: unknownNumber("The bonus's own target, when it has one separate from quota."),
        spiff_for: z.enum(SPIFF_FOR).describe("For a spiff, what earns it. 'not_applicable' otherwise."),
        tiers: z.array(
          z.object({
            at_pct: unknownNumber('Attainment percent that unlocks this level.'),
            pays_pct: unknownNumber("For a period_kicker, the boost in percent."),
            pays_amount: unknownNumber('For a fixed bonus or spiff, the dollar amount.'),
          }),
        ),
        source: readSource,
      }),
    )
    .describe('Bonuses on top of commission. Empty if none.'),
  caps: z
    .array(
      z.object({
        kind: z.enum(CAP_KINDS),
        pct_of_target: unknownNumber('The cap as a percent of target pay or quota.'),
        amount: unknownNumber('The cap in dollars.'),
        source: readSource,
      }),
    )
    .describe('Limits on how much commission can be earned. Empty if none.'),
  clawbacks: z
    .array(
      z.object({
        within_months: unknownNumber('How many months after the sale a cancellation takes commission back.'),
        share_pct: unknownNumber('Percent of the commission taken back.'),
        source: readSource,
      }),
    )
    .describe('Commission taken back when a customer cancels or doesn\'t pay. Empty if none.'),
  draws: z
    .array(
      z.object({
        kind: z.enum(DRAW_KINDS),
        monthly_amount: unknownNumber('Draw per month in dollars.'),
        months: unknownNumber('How many months the draw lasts.'),
        source: readSource,
      }),
    )
    .describe('Advances paid against future commission. Empty if none.'),
  paid_when: z.enum(PAY_TIMING).describe("When commission is paid out. 'unknown' if not said."),
  other_features: z
    .array(z.enum(OTHER_FEATURES))
    .describe('Other plan features mentioned but not captured above. Empty if none.'),
});
export type WireRead = z.infer<typeof WireRead>;

// ── What IOI keeps ───────────────────────────────────────────────────────────

const amount = z.number().min(0).max(10_000_000_000).nullable();
const pct = z.number().min(0).max(1000).nullable();
const source = z.enum(SOURCES);

/** Generic role words only. Anything else in a title (a company, a product,
 *  a person) drops the whole title rather than store it. */
const TITLE_WORDS = new Set(
  (
    'senior sr junior jr associate principal lead staff head chief vp vice president director manager ' +
    'account accounts executive executives ae aes rep representative sales seller development business bdr sdr adr ' +
    'enterprise strategic major named commercial corporate mid market mid-market midmarket mm smb small medium ' +
    'inside outside field territory regional region national global partner partners channel alliances ' +
    'customer customers success csm cse am growth expansion renewals renewal retention solutions solution ' +
    'engineer engineering consultant specialist advisor new logo logos hunter farmer i ii iii iv of and & -'
  ).split(' '),
);

export function cleanTitle(raw: string | null | undefined): string | null {
  const title = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!title || title.length > 48) return null;
  const words = title.toLowerCase().split(/[\s/,]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => TITLE_WORDS.has(w)) ? title : null;
}

export const PlanRecord = z.object({
  format: z.literal(FORMAT_VERSION),
  role: z.object({
    level: z.enum(ROLE_LEVELS),
    title: z
      .string()
      .nullable()
      .refine((t) => t === null || cleanTitle(t) === t, 'Role title must be a generic job title.'),
  }),
  quota: z.object({ period: z.enum(PERIODS), measure: z.enum(MEASURES), amount, source }),
  pay_rules: z
    .array(
      z.object({
        applies_to: z.enum(APPLIES_TO),
        method: z.enum(PAY_METHODS),
        value_basis: z.enum(VALUE_BASES),
        rate: amount,
        source,
      }),
    )
    .max(6),
  one_time: z.object({ counts_pct: pct, source }),
  accelerators: z
    .array(
      z.object({
        kind: z.enum(ACCEL_KINDS),
        starts_at_pct: pct,
        starts_at_amount: amount,
        rate: amount,
        source,
      }),
    )
    .max(6),
  floors: z.array(z.object({ kind: z.enum(FLOOR_KINDS), below_pct: pct, rate: amount, source })).max(3),
  discount_rules: z
    .array(z.object({ over_pct: pct, effect: z.enum(DISCOUNT_EFFECTS), rate: amount, source }))
    .max(4),
  bonuses: z
    .array(
      z.object({
        kind: z.enum(BONUS_KINDS),
        period: z.enum(PERIODS),
        measure: z.enum(MEASURES),
        target_amount: amount,
        spiff_for: z.enum(SPIFF_FOR),
        tiers: z.array(z.object({ at_pct: pct, pays_pct: pct, pays_amount: amount })).max(6),
        source,
      }),
    )
    .max(6),
  caps: z.array(z.object({ kind: z.enum(CAP_KINDS), pct_of_target: pct, amount, source })).max(3),
  clawbacks: z.array(z.object({ within_months: pct, share_pct: pct, source })).max(3),
  draws: z.array(z.object({ kind: z.enum(DRAW_KINDS), monthly_amount: amount, months: pct, source })).max(2),
  paid_when: z.enum(PAY_TIMING),
  other_features: z.array(z.enum(OTHER_FEATURES)).max(10),
});
export type PlanRecord = z.infer<typeof PlanRecord>;

/**
 * Choices a person makes to get a number out of IOI when the real plan is
 * something the engine can't run yet. Kept apart from the record, which
 * always says what the plan really is.
 */
export const CalcChoices = z.object({
  /** An annual or half-year quota, run as a quarterly one (÷4 or ÷2). */
  as_quarterly: z.boolean(),
  /** A total-contract-value quota or rate, run as first-year value. */
  tcv_as_first_year: z.boolean(),
});
export type CalcChoices = z.infer<typeof CalcChoices>;
export const NO_CHOICES: CalcChoices = { as_quarterly: false, tcv_as_first_year: false };

// ── Wire -> record ───────────────────────────────────────────────────────────

/** -1 (or anything negative, or not finite) means "not given". */
const val = (n: number) => (Number.isFinite(n) && n >= 0 ? n : null);

export function recordFromWire(w: WireRead): PlanRecord {
  return {
    format: FORMAT_VERSION,
    role: { level: w.role_level, title: cleanTitle(w.role_title) },
    quota: { period: w.quota.period, measure: w.quota.measure, amount: val(w.quota.amount), source: w.quota.source },
    pay_rules: w.pay_rules.slice(0, 6).map((r) => ({
      applies_to: r.applies_to,
      method: r.method,
      value_basis: r.value_basis,
      rate: val(r.rate),
      source: r.source,
    })),
    one_time: { counts_pct: val(w.one_time_counts_pct), source: w.one_time_source },
    accelerators: w.accelerators.slice(0, 6).map((a) => ({
      kind: a.kind,
      starts_at_pct: val(a.starts_at_pct),
      starts_at_amount: val(a.starts_at_amount),
      rate: val(a.rate),
      source: a.source,
    })),
    floors: w.floors.slice(0, 3).map((f) => ({ kind: f.kind, below_pct: val(f.below_pct), rate: val(f.rate), source: f.source })),
    discount_rules: w.discount_rules
      .slice(0, 4)
      .map((d) => ({ over_pct: val(d.over_pct), effect: d.effect, rate: val(d.rate), source: d.source })),
    bonuses: w.bonuses.slice(0, 6).map((b) => ({
      kind: b.kind,
      period: b.period,
      measure: b.measure,
      target_amount: val(b.target_amount),
      spiff_for: b.spiff_for,
      tiers: b.tiers.slice(0, 6).map((t) => ({ at_pct: val(t.at_pct), pays_pct: val(t.pays_pct), pays_amount: val(t.pays_amount) })),
      source: b.source,
    })),
    caps: w.caps.slice(0, 3).map((c) => ({ kind: c.kind, pct_of_target: val(c.pct_of_target), amount: val(c.amount), source: c.source })),
    clawbacks: w.clawbacks.slice(0, 3).map((c) => ({ within_months: val(c.within_months), share_pct: val(c.share_pct), source: c.source })),
    draws: w.draws.slice(0, 2).map((d) => ({ kind: d.kind, monthly_amount: val(d.monthly_amount), months: val(d.months), source: d.source })),
    paid_when: w.paid_when,
    other_features: [...new Set(w.other_features)].slice(0, 10),
  };
}

// ── Record -> wire, for corrections ─────────────────────────────────────────

/** A record in the format Claude fills, so a correction can start from it. */
export function wireFromRecord(r: PlanRecord): Omit<WireRead, 'input_kind'> {
  const n = (v: number | null) => (v === null ? -1 : v);
  const s = (v: Source) => (v === 'assumed' ? 'assumed' : 'stated') as WireRead['quota']['source'];
  return {
    role_level: r.role.level,
    role_title: r.role.title ?? '',
    quota: { period: r.quota.period, measure: r.quota.measure, amount: n(r.quota.amount), source: s(r.quota.source) },
    pay_rules: r.pay_rules.map((p) => ({ applies_to: p.applies_to, method: p.method, value_basis: p.value_basis, rate: n(p.rate), source: s(p.source) })),
    one_time_counts_pct: n(r.one_time.counts_pct),
    one_time_source: s(r.one_time.source),
    accelerators: r.accelerators.map((a) => ({
      kind: a.kind, starts_at_pct: n(a.starts_at_pct), starts_at_amount: n(a.starts_at_amount), rate: n(a.rate), source: s(a.source),
    })),
    floors: r.floors.map((f) => ({ kind: f.kind, below_pct: n(f.below_pct), rate: n(f.rate), source: s(f.source) })),
    discount_rules: r.discount_rules.map((d) => ({ over_pct: n(d.over_pct), effect: d.effect, rate: n(d.rate), source: s(d.source) })),
    bonuses: r.bonuses.map((b) => ({
      kind: b.kind, period: b.period, measure: b.measure, target_amount: n(b.target_amount), spiff_for: b.spiff_for,
      tiers: b.tiers.map((t) => ({ at_pct: n(t.at_pct), pays_pct: n(t.pays_pct), pays_amount: n(t.pays_amount) })),
      source: s(b.source),
    })),
    caps: r.caps.map((c) => ({ kind: c.kind, pct_of_target: n(c.pct_of_target), amount: n(c.amount), source: s(c.source) })),
    clawbacks: r.clawbacks.map((c) => ({ within_months: n(c.within_months), share_pct: n(c.share_pct), source: s(c.source) })),
    draws: r.draws.map((d) => ({ kind: d.kind, monthly_amount: n(d.monthly_amount), months: n(d.months), source: s(d.source) })),
    paid_when: r.paid_when,
    other_features: r.other_features,
  };
}
