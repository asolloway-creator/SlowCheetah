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
 *
 * Fields added since format 1 first shipped (quota exclusions, payout cadence
 * and lag, what a clawback takes back, the note on an uncategorized feature)
 * default when absent, so records confirmed before them still parse.
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
export const APPLIES_TO = ['all', 'new_business', 'expansion', 'renewal', 'recurring', 'one_time', 'services', 'hardware', 'other'] as const;
export const ACCEL_KINDS = ['forward_rate', 'retroactive_rate', 'retroactive_bump', 'marginal_tier', 'unknown'] as const;
export const FLOOR_KINDS = ['no_commission_below', 'reduced_rate_below'] as const;
export const DISCOUNT_EFFECTS = ['reduced_rate', 'no_commission', 'approval_only', 'other'] as const;
export const BONUS_KINDS = ['period_kicker', 'attainment_bonus', 'spiff', 'other'] as const;
export const SPIFF_FOR = ['product', 'multi_year', 'prepay', 'new_logo', 'activity', 'other', 'not_applicable'] as const;
export const CAP_KINDS = ['total_commission', 'per_deal', 'other'] as const;
export const DRAW_KINDS = ['recoverable', 'non_recoverable', 'unknown'] as const;
export const PAY_TIMING = ['booking', 'invoice', 'collection', 'go_live', 'other', 'unknown'] as const;
export const PAY_CADENCES = ['monthly', 'quarterly', 'other', 'unknown'] as const;
/** Business the person says doesn't count toward quota. */
export const QUOTA_EXCLUDES = ['renewals', 'expansion', 'one_time', 'other'] as const;
export const CLAWBACK_OF = ['commission', 'bonus'] as const;
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
export type PayCadence = (typeof PAY_CADENCES)[number];
export type QuotaExclude = (typeof QUOTA_EXCLUDES)[number];
export type ClawbackOf = (typeof CLAWBACK_OF)[number];
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

/** Floors, discount rules, caps, clawbacks and draws share one flat list:
 *  the grammar Claude's structured output compiles has a size limit, and
 *  five separate nested lists blew past it. */
export const LIMIT_KINDS = [
  'floor_no_commission', 'floor_reduced_rate', 'discount_reduced_rate', 'discount_no_commission', 'discount_needs_approval',
  'cap_total', 'cap_per_deal', 'clawback', 'clawback_bonus', 'draw_recoverable', 'draw_non_recoverable',
] as const;

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
  quota_period: z.enum(PERIODS).describe('How often quota resets.'),
  quota_measure: z
    .enum(MEASURES)
    .describe(
      "What counts toward quota. new_arr: new annual recurring revenue. acv: annual contract value. first_year_value: first-year contract value. mrr: monthly recurring revenue. tcv: total contract value across all years. bookings: 'bookings' with no further detail. units/deals: a count.",
    ),
  quota_amount: unknownNumber('Quota for one period, in the measure: dollars for money measures, a count for units or deals.'),
  quota_source: readSource,
  quota_excludes: z
    .array(z.enum(QUOTA_EXCLUDES))
    .describe(
      "Business the person says doesn't count toward quota: renewals, expansion (upsells, add-ons), one_time (setup, services, hardware), other. Empty if they don't say.",
    ),
  pay_rules: z
    .array(
      z.object({
        applies_to: z
          .enum(APPLIES_TO)
          .describe(
            "Which business the rule pays on. 'all' unless the plan pays different rates on different business. services: setup, implementation, onboarding or professional services. hardware: hardware and devices. one_time: one-time charges when they don't say which.",
          ),
        method: z.enum(PAY_METHODS),
        value_basis: z.enum(VALUE_BASES).describe("What a percent is taken of. 'not_applicable' for months of MRR and flat amounts."),
        rate: unknownNumber('The base rate: a percent as a number (7 for 7%), months of MRR as a number (2), or dollars for a flat amount.'),
        source: readSource,
      }),
    )
    .describe('How each deal pays before any accelerator. One entry per distinct rate.'),
  one_time_counts_pct: unknownNumber(
    'Percent of one-time charges (setup, implementation, services, and hardware unless hardware has a rate of its own) that counts toward commission. 0 when commission is on subscription or ARR only. 100 when one-time charges pay at the full rate.',
  ),
  one_time_source: readSource,
  accelerators: z
    .array(
      z.object({
        kind: z
          .enum(ACCEL_KINDS)
          .describe(
            'forward_rate: once past the line, that deal and every deal after it earn a higher rate. retroactive_rate: once past the line, every deal in the period is repaid at the higher rate, earlier ones included. retroactive_bump: once past the line, all commission for the period gets a percent boost, earlier deals included. marginal_tier: only the portion of attainment above the line earns the higher rate. unknown: an accelerator is mentioned but not how it applies.',
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
  bonus_levels: z
    .array(
      z.object({
        kind: z
          .enum(BONUS_KINDS)
          .describe(
            "period_kicker: a percent boost on a whole period's commission for crossing an attainment level. attainment_bonus: a fixed dollar bonus for reaching an attainment level. spiff: a bonus for selling a particular product or doing a particular thing.",
          ),
        period: z.enum(PERIODS),
        measure: z.enum(MEASURES).describe('What the bonus measures attainment on.'),
        target_amount: unknownNumber("The bonus's own target, when it has one separate from quota."),
        spiff_for: z.enum(SPIFF_FOR).describe("For a spiff, what earns it. 'not_applicable' otherwise."),
        at_pct: unknownNumber('Attainment percent that unlocks this level.'),
        pays_pct: unknownNumber('For a period_kicker, the boost in percent.'),
        pays_amount: unknownNumber('For a fixed bonus or spiff, the dollar amount.'),
        source: readSource,
      }),
    )
    .describe('Bonuses on top of commission, one entry per level. A bonus with two levels is two entries with the same kind, period and target. Empty if none.'),
  limits: z
    .array(
      z.object({
        kind: z
          .enum(LIMIT_KINDS)
          .describe(
            'floor_no_commission: nothing paid below an attainment level. floor_reduced_rate: a lower rate below an attainment level. discount_reduced_rate / discount_no_commission / discount_needs_approval: what happens to deals discounted past a point (ordinary "commission is on the discounted price" is not one). cap_total: total commission is capped. cap_per_deal: commission on one deal is capped. clawback: commission taken back when a customer cancels or doesn\'t pay. clawback_bonus: a bonus, not commission, taken back that way. draw_recoverable / draw_non_recoverable: an advance against future commission.',
          ),
        pct: unknownNumber('floor: the attainment percent. discount: the discount percent. cap_total: the cap as a percent of target pay. clawback, clawback_bonus: the share taken back.'),
        amount: unknownNumber('cap: the cap in dollars. draw: the draw per month in dollars.'),
        rate: unknownNumber('floor_reduced_rate and discount_reduced_rate: the lower rate, same unit as the base rate.'),
        months: unknownNumber('clawback, clawback_bonus: within how many months of the sale (90 days is 3). draw: how many months it lasts.'),
        source: readSource,
      }),
    )
    .describe('Floors, discount rules, caps, clawbacks and draws. "Uncapped" means no cap entry. Empty if none.'),
  paid_when: z.enum(PAY_TIMING).describe("What makes commission payable: booking, invoice, collection (the customer pays), go_live. 'unknown' if not said."),
  paid_cadence: z.enum(PAY_CADENCES).describe("How often commission is paid out: monthly, quarterly. 'unknown' if not said."),
  paid_lag_months: unknownNumber('How many months after it is earned commission is paid ("a month in arrears" is 1).'),
  other_features: z.array(z.enum(OTHER_FEATURES)).describe('Other plan features mentioned but not captured above. Empty if none.'),
  other_note: z
    .string()
    .describe(
      "When other_features includes 'other': what it is, in under 12 plain words of your own, like \"A bonus for booking 20 demos a month\". Never their wording, never a name. Empty string otherwise.",
    ),
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
  quota: z.object({
    period: z.enum(PERIODS),
    measure: z.enum(MEASURES),
    amount,
    source,
    excludes: z.array(z.enum(QUOTA_EXCLUDES)).max(4).default([]),
  }),
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
  clawbacks: z
    .array(z.object({ of: z.enum(CLAWBACK_OF).default('commission'), within_months: pct, share_pct: pct, source }))
    .max(3),
  draws: z.array(z.object({ kind: z.enum(DRAW_KINDS), monthly_amount: amount, months: pct, source })).max(2),
  paid_when: z.enum(PAY_TIMING),
  paid_cadence: z.enum(PAY_CADENCES).default('unknown'),
  paid_lag_months: z.number().min(0).max(24).nullable().default(null),
  other_features: z.array(z.enum(OTHER_FEATURES)).max(10),
  /** The reader's own words for an 'other' feature: never the person's. */
  other_note: z.string().max(100).nullable().default(null),
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
  const limits = (kinds: (typeof LIMIT_KINDS)[number][]) => w.limits.filter((l) => kinds.includes(l.kind));
  // Levels of the same bonus arrive as separate entries; they share kind,
  // period, measure, target and spiff_for.
  const bonuses: PlanRecord['bonuses'] = [];
  for (const l of w.bonus_levels) {
    const target = val(l.target_amount);
    const same = bonuses.find(
      (b) => b.kind === l.kind && b.period === l.period && b.measure === l.measure && b.target_amount === target && b.spiff_for === l.spiff_for,
    );
    const tier = { at_pct: val(l.at_pct), pays_pct: val(l.pays_pct), pays_amount: val(l.pays_amount) };
    if (same && same.tiers.length < 6) same.tiers.push(tier);
    else if (bonuses.length < 6) {
      bonuses.push({ kind: l.kind, period: l.period, measure: l.measure, target_amount: target, spiff_for: l.spiff_for, tiers: [tier], source: l.source });
    }
  }
  return {
    format: FORMAT_VERSION,
    role: { level: w.role_level, title: cleanTitle(w.role_title) },
    quota: {
      period: w.quota_period,
      measure: w.quota_measure,
      amount: val(w.quota_amount),
      source: w.quota_source,
      excludes: [...new Set(w.quota_excludes)].slice(0, 4),
    },
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
    floors: limits(['floor_no_commission', 'floor_reduced_rate'])
      .slice(0, 3)
      .map((l) => ({
        kind: l.kind === 'floor_no_commission' ? 'no_commission_below' : 'reduced_rate_below',
        below_pct: val(l.pct),
        rate: l.kind === 'floor_reduced_rate' ? val(l.rate) : null,
        source: l.source,
      })),
    discount_rules: limits(['discount_reduced_rate', 'discount_no_commission', 'discount_needs_approval'])
      .slice(0, 4)
      .map((l) => ({
        over_pct: val(l.pct),
        effect: l.kind === 'discount_reduced_rate' ? 'reduced_rate' : l.kind === 'discount_no_commission' ? 'no_commission' : 'approval_only',
        rate: l.kind === 'discount_reduced_rate' ? val(l.rate) : null,
        source: l.source,
      })),
    bonuses,
    caps: limits(['cap_total', 'cap_per_deal'])
      .slice(0, 3)
      .map((l) => ({
        kind: l.kind === 'cap_total' ? 'total_commission' : 'per_deal',
        pct_of_target: val(l.pct),
        amount: val(l.amount),
        source: l.source,
      })),
    clawbacks: limits(['clawback', 'clawback_bonus'])
      .slice(0, 3)
      .map((l) => ({
        of: l.kind === 'clawback_bonus' ? 'bonus' : 'commission',
        within_months: val(l.months),
        share_pct: val(l.pct),
        source: l.source,
      })),
    draws: limits(['draw_recoverable', 'draw_non_recoverable'])
      .slice(0, 2)
      .map((l) => ({
        kind: l.kind === 'draw_recoverable' ? 'recoverable' : 'non_recoverable',
        monthly_amount: val(l.amount),
        months: val(l.months),
        source: l.source,
      })),
    paid_when: w.paid_when,
    paid_cadence: w.paid_cadence,
    paid_lag_months: (() => {
      const lag = val(w.paid_lag_months);
      return lag === null ? null : Math.min(24, lag);
    })(),
    other_features: [...new Set(w.other_features)].slice(0, 10),
    other_note: w.other_features.includes('other') ? cleanNote(w.other_note) : null,
  };
}

/** One short line, in the reader's words: trimmed, one sentence, no closing stop. */
export function cleanNote(raw: string | null | undefined): string | null {
  const note = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
  return note && note.length <= 100 ? note : null;
}

// ── Record -> wire, for corrections ─────────────────────────────────────────

/** A record in the format Claude fills, so a correction can start from it. */
export function wireFromRecord(r: PlanRecord): Omit<WireRead, 'input_kind'> {
  const n = (v: number | null) => (v === null ? -1 : v);
  const s = (v: Source) => (v === 'assumed' ? 'assumed' : 'stated') as WireRead['quota_source'];
  type Limit = WireRead['limits'][number];
  const limit = (kind: Limit['kind'], f: Partial<Record<'pct' | 'amount' | 'rate' | 'months', number | null>>, source: Source): Limit => ({
    kind,
    pct: n(f.pct ?? null),
    amount: n(f.amount ?? null),
    rate: n(f.rate ?? null),
    months: n(f.months ?? null),
    source: s(source),
  });
  return {
    role_level: r.role.level,
    role_title: r.role.title ?? '',
    quota_period: r.quota.period,
    quota_measure: r.quota.measure,
    quota_amount: n(r.quota.amount),
    quota_source: s(r.quota.source),
    quota_excludes: r.quota.excludes,
    pay_rules: r.pay_rules.map((p) => ({ applies_to: p.applies_to, method: p.method, value_basis: p.value_basis, rate: n(p.rate), source: s(p.source) })),
    one_time_counts_pct: n(r.one_time.counts_pct),
    one_time_source: s(r.one_time.source),
    accelerators: r.accelerators.map((a) => ({
      kind: a.kind, starts_at_pct: n(a.starts_at_pct), starts_at_amount: n(a.starts_at_amount), rate: n(a.rate), source: s(a.source),
    })),
    bonus_levels: r.bonuses.flatMap((b) =>
      (b.tiers.length ? b.tiers : [{ at_pct: null, pays_pct: null, pays_amount: null }]).map((t) => ({
        kind: b.kind, period: b.period, measure: b.measure, target_amount: n(b.target_amount), spiff_for: b.spiff_for,
        at_pct: n(t.at_pct), pays_pct: n(t.pays_pct), pays_amount: n(t.pays_amount), source: s(b.source),
      })),
    ),
    limits: [
      ...r.floors.map((f) => limit(f.kind === 'no_commission_below' ? 'floor_no_commission' : 'floor_reduced_rate', { pct: f.below_pct, rate: f.rate }, f.source)),
      ...r.discount_rules.map((d) =>
        limit(
          d.effect === 'reduced_rate' ? 'discount_reduced_rate' : d.effect === 'no_commission' ? 'discount_no_commission' : 'discount_needs_approval',
          { pct: d.over_pct, rate: d.rate },
          d.source,
        ),
      ),
      ...r.caps.map((c) => limit(c.kind === 'per_deal' ? 'cap_per_deal' : 'cap_total', { pct: c.pct_of_target, amount: c.amount }, c.source)),
      ...r.clawbacks.map((c) => limit(c.of === 'bonus' ? 'clawback_bonus' : 'clawback', { pct: c.share_pct, months: c.within_months }, c.source)),
      ...r.draws.map((d) => limit(d.kind === 'non_recoverable' ? 'draw_non_recoverable' : 'draw_recoverable', { amount: d.monthly_amount, months: d.months }, d.source)),
    ],
    paid_when: r.paid_when,
    paid_cadence: r.paid_cadence,
    paid_lag_months: n(r.paid_lag_months),
    other_features: r.other_features,
    other_note: r.other_note ?? '',
  };
}
