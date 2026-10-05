import { isFixedTier, type CompPlan, type QuarterlyKicker } from '@/lib/calc';
import {
  cleanTitle,
  FORMAT_VERSION,
  NO_CHOICES,
  type AccelKind,
  type CalcChoices,
  type Measure,
  type PlanRecord,
  type Source,
} from './schema';

/**
 * Record -> the plan the pay engine (calc.ts) can run, plus an honest
 * account of everything that didn't make it in exactly. Pure and
 * deterministic: the browser runs it after every answer or fix, and the
 * server runs it again on confirm rather than trusting the browser's copy.
 */

/** How one rule in the record fares in IOI's math. */
export type Status =
  | 'calculated' // exactly as described
  | 'approximated' // close, with a named difference
  | 'not_yet' // left out, and it changes what deals pay
  | 'recorded'; // kept, but it doesn't change what a deal pays

export type Area =
  | 'quota'
  | 'quota_excludes'
  | 'pay_rules'
  | 'one_time'
  | 'accelerators'
  | 'floors'
  | 'discount_rules'
  | 'bonuses'
  | 'caps'
  | 'clawbacks'
  | 'draws'
  | 'paid_when'
  | 'other_features';

export type Note =
  | 'exact'
  | 'mrr_quota_as_arr'
  | 'mrr_rate_as_annual'
  | 'as_quarterly'
  | 'tcv_as_first_year'
  | 'quota_exclusion'
  | 'one_time_from_rates'
  | 'one_time_above_base'
  | 'one_time_on_mrr_plan'
  | 'other_business_rate'
  | 'marginal_split'
  | 'more_steps'
  | 'floor'
  | 'discount_rule'
  | 'kicker_more_tiers'
  | 'kicker_not_quarterly'
  | 'kicker_not_arr'
  | 'second_kicker'
  | 'attainment_bonus'
  | 'spiff'
  | 'other_bonus'
  | 'cap'
  | 'clawback'
  | 'draw'
  | 'paid_when'
  | 'feature';

export type CoverageItem = { area: Area; index: number; status: Status; note: Note };

/** Something the engine needs that the description didn't give. */
export type Topic =
  | 'quota_period'
  | 'quota_measure'
  | 'quota_amount'
  | 'base_method'
  | 'base_basis'
  | 'base_rate'
  | 'one_time_weight'
  | 'one_time_kind'
  | 'accelerator_kind'
  | 'accelerator_start'
  | 'accelerator_rate'
  | 'kicker_target'
  | 'kicker_start'
  | 'kicker_pay';

export type Gap = { topic: Topic; index: number };

/** Something described that the engine can't run at all yet. Some have a
 *  person-chosen conversion (CalcChoices); the rest block the numbers. */
export type Limit =
  | 'period_year'
  | 'period_half'
  | 'measure_tcv'
  | 'measure_other'
  | 'method_flat'
  | 'method_margin'
  | 'method_other'
  | 'basis_tcv'
  | 'basis_other';

/** A number-changing fact Claude inferred, or a default the mapping had to
 *  pick. Shown as "We assumed ..." with a way to change it. */
export type Assumed = { topic: Topic; index: number; why: 'inferred' | 'default' };

export type Mapping = {
  plan: CompPlan | null;
  gaps: Gap[];
  limits: Limit[];
  coverage: CoverageItem[];
  assumed: Assumed[];
  /** Index of the pay rule the engine uses as the base rate, if any. */
  baseRule: number | null;
  /** Index of the accelerator the engine runs as its first step, if any. */
  accelRule: number | null;
  /** Indexes of the accelerators it runs as further steps, in rising order. */
  stepRules: number[];
  /** Index of the bonus run as the quarterly kicker, if any. */
  kickerRule: number | null;
};

const ARR_LIKE: Measure[] = ['new_arr', 'acv', 'first_year_value'];
const TOPIC_ORDER: Topic[] = [
  'quota_amount',
  'quota_period',
  'quota_measure',
  'base_method',
  'base_rate',
  'base_basis',
  'accelerator_kind',
  'accelerator_start',
  'accelerator_rate',
  'kicker_target',
  'kicker_start',
  'kicker_pay',
  'one_time_kind',
  'one_time_weight',
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function mapRecord(r: PlanRecord, choices: CalcChoices = NO_CHOICES): Mapping {
  const gaps: Gap[] = [];
  const limits: Limit[] = [];
  const coverage: CoverageItem[] = [];
  const assumed: Assumed[] = [];
  const cover = (area: Area, index: number, status: Status, note: Note) => coverage.push({ area, index, status, note });
  const inferred = (s: Source) => s === 'assumed';

  // ── Quota ──────────────────────────────────────────────────────────────
  let period: CompPlan['period'] | null = null;
  let periodFactor = 1;
  let quotaStatus: Status = 'calculated';
  let quotaNote: Note = 'exact';
  switch (r.quota.period) {
    case 'month':
    case 'quarter':
      period = r.quota.period;
      break;
    case 'year':
    case 'half':
      if (choices.as_quarterly) {
        period = 'quarter';
        periodFactor = r.quota.period === 'year' ? 1 / 4 : 1 / 2;
        quotaStatus = 'approximated';
        quotaNote = 'as_quarterly';
      } else {
        limits.push(r.quota.period === 'year' ? 'period_year' : 'period_half');
      }
      break;
    default:
      gaps.push({ topic: 'quota_period', index: 0 });
  }

  let basis: CompPlan['quota_basis'] | null = null;
  let measureFactor = 1;
  const m = r.quota.measure;
  if (ARR_LIKE.includes(m)) basis = 'arr';
  else if (m === 'units' || m === 'deals') basis = 'units';
  else if (m === 'mrr') {
    basis = 'arr';
    measureFactor = 12;
    if (quotaStatus === 'calculated') quotaNote = 'mrr_quota_as_arr';
  } else if (m === 'tcv') {
    if (choices.tcv_as_first_year) {
      basis = 'arr';
      quotaStatus = 'approximated';
      quotaNote = 'tcv_as_first_year';
    } else limits.push('measure_tcv');
  } else if (m === 'bookings' || m === 'unknown') gaps.push({ topic: 'quota_measure', index: 0 });
  else limits.push('measure_other');

  // Units and deals are counts: an annual 40 deals is 10 a quarter, but never x12.
  const toQuotaUnits = (n: number) => round2(n * periodFactor * (basis === 'units' ? 1 : measureFactor));
  const quota = r.quota.amount !== null && r.quota.amount > 0 ? toQuotaUnits(r.quota.amount) : null;
  if (quota === null) gaps.push({ topic: 'quota_amount', index: 0 });
  // One source covers the whole quota line, so the fix reopens all of it.
  if (inferred(r.quota.source)) assumed.push({ topic: 'quota_period', index: 0, why: 'inferred' });
  cover('quota', 0, quotaStatus, quotaNote);
  // What doesn't count toward quota. One-time charges never do in IOI's math;
  // IOI treats every deal as new business, so the rest are kept as noted.
  if (r.quota.excludes.length > 0) {
    cover('quota_excludes', 0, r.quota.excludes.every((x) => x === 'one_time') ? 'calculated' : 'recorded', 'quota_exclusion');
  }

  // ── Base pay ───────────────────────────────────────────────────────────
  const rules = r.pay_rules;
  const ONE_TIME = ['one_time', 'services', 'hardware'];
  const pick = (want: string) => rules.findIndex((x) => x.applies_to === want);
  let baseRule = [pick('all'), pick('new_business'), pick('recurring')].find((i) => i >= 0) ?? -1;
  if (baseRule < 0) baseRule = rules.findIndex((x) => !ONE_TIME.includes(x.applies_to));
  const base = baseRule >= 0 ? rules[baseRule] : null;

  let style: CompPlan['commission_style'] | null = null;
  let rateFactor = 1;
  let baseStatus: Status = 'calculated';
  let baseNote: Note = 'exact';
  if (!base || base.method === 'unknown') gaps.push({ topic: 'base_method', index: Math.max(0, baseRule) });
  else if (base.method === 'months_of_mrr') style = 'months_of_mrr';
  else if (base.method === 'percent_of_value') {
    const b = base.value_basis;
    if (b === 'arr' || b === 'acv' || b === 'first_year_value' || b === 'not_applicable') style = 'percent';
    else if (b === 'unknown') {
      style = 'percent';
      assumed.push({ topic: 'base_basis', index: baseRule, why: 'default' });
    } else if (b === 'mrr') {
      // A percent of monthly value, per deal: the same money as 1/12 of
      // that percent of annual value, which is what the engine runs on.
      style = 'percent';
      rateFactor = 1 / 12;
      baseNote = 'mrr_rate_as_annual';
    } else if (b === 'tcv') {
      if (choices.tcv_as_first_year) {
        style = 'percent';
        baseStatus = 'approximated';
        baseNote = 'tcv_as_first_year';
      } else limits.push('basis_tcv');
    } else limits.push('basis_other');
  } else if (base.method === 'flat_per_unit' || base.method === 'flat_per_deal') limits.push('method_flat');
  else if (base.method === 'percent_of_margin') limits.push('method_margin');
  else limits.push('method_other');

  const baseRate = base && base.rate !== null ? round2(base.rate * rateFactor) : null;
  if (base && base.method !== 'unknown' && base.rate === null) gaps.push({ topic: 'base_rate', index: baseRule });
  if (base && inferred(base.source)) assumed.push({ topic: 'base_rate', index: baseRule, why: 'inferred' });
  if (base) cover('pay_rules', baseRule, baseStatus, baseNote);

  // ── Other pay rules and one-time charges ───────────────────────────────
  // Hardware with a rate of its own pays that flat, never accelerated. Setup
  // and services count toward the deal's rate at a weight. A one-time rate
  // that doesn't say which charges it's for, on a plan that says how setup
  // counts too, gets asked about rather than blended into one weight.
  let oneTimeWeight: number | null = null;
  let hardwareRate: number | null = null;
  rules.forEach((rule, i) => {
    if (i === baseRule) return;
    if (rule.applies_to === 'hardware') {
      if (rule.method === 'percent_of_value' && rule.rate !== null && hardwareRate === null) {
        hardwareRate = round2(rule.rate);
        cover('pay_rules', i, 'calculated', 'exact');
      } else cover('pay_rules', i, 'not_yet', 'other_business_rate');
      return;
    }
    const unsaid = rule.applies_to === 'one_time' && r.one_time.counts_pct !== null && rule.source !== 'answered' && rule.source !== 'corrected';
    if (unsaid) {
      gaps.push({ topic: 'one_time_kind', index: i });
      return cover('pay_rules', i, 'calculated', 'exact');
    }
    if (rule.applies_to === 'one_time' || rule.applies_to === 'services') {
      const sameUnits = style === 'percent' && rule.method === 'percent_of_value';
      if (sameUnits && baseRate && rule.rate !== null) {
        const w = (rule.rate / (base!.rate as number)) * 100;
        if (w <= 100) {
          oneTimeWeight = round2(w);
          cover('pay_rules', i, 'calculated', 'one_time_from_rates');
        } else cover('pay_rules', i, 'not_yet', 'one_time_above_base');
      } else cover('pay_rules', i, 'not_yet', style === 'months_of_mrr' ? 'one_time_on_mrr_plan' : 'other_business_rate');
    } else {
      cover('pay_rules', i, 'not_yet', 'other_business_rate');
    }
  });

  if (style === 'percent') {
    if (oneTimeWeight === null) {
      const c = r.one_time.counts_pct;
      if (c === null) {
        oneTimeWeight = 0;
        assumed.push({ topic: 'one_time_weight', index: 0, why: 'default' });
      } else if (c <= 100) {
        oneTimeWeight = c;
        if (inferred(r.one_time.source)) assumed.push({ topic: 'one_time_weight', index: 0, why: 'inferred' });
      } else {
        oneTimeWeight = 100;
        cover('one_time', 0, 'not_yet', 'one_time_above_base');
      }
    }
    if (!coverage.some((c) => c.area === 'one_time')) cover('one_time', 0, 'calculated', 'exact');
  } else if (style === 'months_of_mrr') {
    oneTimeWeight = 0;
    if ((r.one_time.counts_pct ?? 0) > 0) cover('one_time', 0, 'not_yet', 'one_time_on_mrr_plan');
  }

  // ── Accelerators ───────────────────────────────────────────────────────
  const startOf = (a: PlanRecord['accelerators'][number]) =>
    a.starts_at_amount !== null && quota
      ? (toQuotaUnits(a.starts_at_amount) / quota) * 100
      : (a.starts_at_pct ?? Number.POSITIVE_INFINITY);
  const accelOrder = r.accelerators.map((a, i) => ({ a, i })).sort((x, y) => startOf(x.a) - startOf(y.a));
  let accelStyle: CompPlan['accelerator_style'] = 'none';
  let threshold = 0;
  let accelRate = 0;
  let accelRule: number | null = null;
  const steps: { threshold: number; rate: number }[] = [];
  const stepRules: number[] = [];
  if (accelOrder.length > 0) {
    const { a, i } = accelOrder[0];
    accelRule = i;
    let status: Status = 'calculated';
    let note: Note = 'exact';
    if (a.starts_at_amount !== null) threshold = toQuotaUnits(a.starts_at_amount);
    else if (a.starts_at_pct !== null && quota !== null) threshold = round2((quota * a.starts_at_pct) / 100);
    else if (a.starts_at_pct === null) gaps.push({ topic: 'accelerator_start', index: i });

    const kind: AccelKind = a.kind;
    if (kind === 'unknown') gaps.push({ topic: 'accelerator_kind', index: i });
    else if (a.rate === null) gaps.push({ topic: 'accelerator_rate', index: i });
    else if (kind === 'forward_rate' || kind === 'marginal_tier') {
      accelStyle = 'rate_switch';
      accelRate = round2(a.rate * rateFactor);
      if (kind === 'marginal_tier') {
        status = 'approximated';
        note = 'marginal_split';
      }
    } else if (kind === 'retroactive_bump') {
      accelStyle = 'retro_bump';
      accelRate = round2(a.rate);
    } else if (kind === 'retroactive_rate') {
      // Repaying every deal at the new rate is the same money as bumping the
      // whole period by (new / base - 1).
      if (baseRate && base!.rate && a.rate > base!.rate) {
        accelStyle = 'retro_bump';
        accelRate = round2((a.rate / base!.rate - 1) * 100);
      } else gaps.push({ topic: baseRate ? 'accelerator_rate' : 'base_rate', index: baseRate ? i : Math.max(0, baseRule) });
    }
    if (inferred(a.source)) assumed.push({ topic: 'accelerator_kind', index: i, why: 'inferred' });
    cover('accelerators', i, status, note);

    // Further steps run when they work the same way as the first and their
    // numbers are all there: "12% past 100%, 15% past 125%". A step that pays
    // some other way, or is missing a number, is kept but not calculated.
    let last = threshold;
    accelOrder.slice(1).forEach(({ a: b, i: j }) => {
      const kind = b.kind === 'unknown' ? a.kind : b.kind;
      const sameStyle =
        accelStyle === 'rate_switch'
          ? kind === 'forward_rate' || kind === 'marginal_tier'
          : accelStyle === 'retro_bump' && (kind === 'retroactive_bump' || kind === 'retroactive_rate');
      const at =
        b.starts_at_amount !== null
          ? toQuotaUnits(b.starts_at_amount)
          : b.starts_at_pct !== null && quota !== null
            ? round2((quota * b.starts_at_pct) / 100)
            : null;
      let rate: number | null = null;
      if (b.rate !== null) {
        if (kind === 'retroactive_rate') rate = baseRate && base!.rate && b.rate > base!.rate ? round2((b.rate / base!.rate - 1) * 100) : null;
        else rate = round2(accelStyle === 'rate_switch' ? b.rate * rateFactor : b.rate);
      }
      if (!sameStyle || at === null || !(at > last) || rate === null || steps.length >= 3) {
        return cover('accelerators', j, 'not_yet', 'more_steps');
      }
      steps.push({ threshold: at, rate });
      stepRules.push(j);
      last = at;
      cover('accelerators', j, kind === 'marginal_tier' ? 'approximated' : 'calculated', kind === 'marginal_tier' ? 'marginal_split' : 'exact');
    });
  }

  r.floors.forEach((_, i) => cover('floors', i, 'not_yet', 'floor'));
  r.discount_rules.forEach((_, i) => cover('discount_rules', i, 'not_yet', 'discount_rule'));

  // ── Bonuses ────────────────────────────────────────────────────────────
  // A quarterly bonus measured on new ARR runs as the plan's quarterly
  // kicker, whether it pays a percent of the quarter's commission
  // (period_kicker) or a fixed amount (attainment_bonus).
  let kicker: QuarterlyKicker | null = null;
  let kickerRule: number | null = null;
  r.bonuses.forEach((b, i) => {
    if (b.kind === 'spiff') return cover('bonuses', i, 'not_yet', 'spiff');
    if (b.kind === 'other') return cover('bonuses', i, 'not_yet', 'other_bonus');
    const fixed = b.kind === 'attainment_bonus';
    if (kickerRule !== null) return cover('bonuses', i, 'not_yet', 'second_kicker');
    const periodOk = b.period === 'quarter' || (b.period === 'unknown' && period === 'quarter');
    if (!periodOk) return cover('bonuses', i, 'not_yet', 'kicker_not_quarterly');
    const measureOk = ARR_LIKE.includes(b.measure) || (b.measure === 'unknown' && basis === 'arr');
    if (!measureOk) return cover('bonuses', i, 'not_yet', 'kicker_not_arr');

    kickerRule = i;
    let target = b.target_amount;
    if (target === null && basis === 'arr' && quota !== null) {
      target = period === 'quarter' ? quota : round2(quota * 3);
      assumed.push({ topic: 'kicker_target', index: i, why: 'default' });
    }
    if (target === null || target <= 0) gaps.push({ topic: 'kicker_target', index: i });
    const pays = (t: (typeof b.tiers)[number]) => (fixed ? t.pays_amount : t.pays_pct);
    const tiers = b.tiers
      .filter((t) => t.at_pct !== null && t.at_pct > 0 && pays(t) !== null)
      .sort((x, y) => (x.at_pct as number) - (y.at_pct as number));
    if (tiers.length === 0) {
      const first = b.tiers[0];
      if (!first || first.at_pct === null || first.at_pct <= 0) gaps.push({ topic: 'kicker_start', index: i });
      if (!first || pays(first) === null) gaps.push({ topic: 'kicker_pay', index: i });
    }
    if (target && target > 0 && tiers.length > 0) {
      const t = tiers
        .slice(0, 2)
        .map((x) =>
          fixed
            ? { attainmentPct: x.at_pct as number, kickerPct: 0, amount: x.pays_amount as number }
            : { attainmentPct: x.at_pct as number, kickerPct: x.pays_pct as number },
        );
      kicker = { target, tiers: t.length === 1 ? [t[0]] : [t[0], t[1]] };
    }
    if (inferred(b.source)) assumed.push({ topic: 'kicker_pay', index: i, why: 'inferred' });
    cover('bonuses', i, tiers.length > 2 ? 'approximated' : 'calculated', tiers.length > 2 ? 'kicker_more_tiers' : 'exact');
  });

  // ── Everything else is kept, not calculated ────────────────────────────
  r.caps.forEach((_, i) => cover('caps', i, 'not_yet', 'cap'));
  r.clawbacks.forEach((_, i) => cover('clawbacks', i, 'recorded', 'clawback'));
  r.draws.forEach((_, i) => cover('draws', i, 'recorded', 'draw'));
  if (r.paid_when !== 'unknown' || r.paid_cadence !== 'unknown' || r.paid_lag_months !== null) {
    cover('paid_when', 0, 'recorded', 'paid_when');
  }
  r.other_features.forEach((f, i) =>
    cover('other_features', i, f === 'territory_rules' || f === 'overlay' || f === 'other' ? 'recorded' : 'not_yet', 'feature'),
  );

  gaps.sort((a, b) => TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic));
  const blocked = gaps.length > 0 || limits.length > 0 || !period || !basis || !style || quota === null || baseRate === null;
  const plan: CompPlan | null = blocked
    ? null
    : {
        role_name: r.role.title ?? LEVEL_TITLES[r.role.level],
        period: period!,
        quota_basis: basis!,
        quota: quota!,
        commission_style: style!,
        base_rate: baseRate!,
        accelerator_style: accelStyle,
        accelerator_threshold: accelStyle === 'none' ? 0 : threshold,
        accelerator_rate: accelStyle === 'none' ? 0 : accelRate,
        ...(accelStyle !== 'none' && steps.length ? { accelerator_steps: steps } : {}),
        one_time_weight: oneTimeWeight ?? 0,
        ...(hardwareRate !== null ? { hardware_rate: hardwareRate } : {}),
        quarterly_kicker: kicker,
        industry: null,
        company_size_band: null,
      };

  return {
    plan,
    gaps: dedupe(gaps),
    limits: [...new Set(limits)],
    coverage,
    assumed: dedupe(assumed),
    baseRule: base ? baseRule : null,
    accelRule,
    stepRules: accelStyle === 'none' ? [] : stepRules,
    kickerRule,
  };
}

const LEVEL_TITLES: Record<PlanRecord['role']['level'], string> = {
  sdr: 'SDR',
  ae: 'Account Executive',
  am: 'Account Manager',
  csm: 'Customer Success Manager',
  se: 'Sales Engineer',
  manager: 'Sales Manager',
  other: 'Rep',
  unknown: 'Rep',
};

function dedupe<T extends { topic: Topic; index: number }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = `${x.topic}:${x.index}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * A plan saved through the numbers form, as a record — so every confirmed
 * plan lands in the same format, however it was entered.
 */
export function recordFromPlan(p: CompPlan): PlanRecord {
  const percent = p.commission_style === 'percent';
  return {
    format: FORMAT_VERSION,
    role: { level: 'unknown', title: cleanTitle(p.role_name) },
    quota: {
      period: p.period,
      measure: p.quota_basis === 'units' ? 'units' : 'new_arr',
      amount: p.quota,
      source: 'stated',
      excludes: [],
    },
    pay_rules: [
      {
        applies_to: 'all',
        method: percent ? 'percent_of_value' : 'months_of_mrr',
        value_basis: percent ? 'first_year_value' : 'not_applicable',
        rate: p.base_rate,
        source: 'stated',
      },
      ...(typeof p.hardware_rate === 'number'
        ? [{ applies_to: 'hardware' as const, method: 'percent_of_value' as const, value_basis: 'not_applicable' as const, rate: p.hardware_rate, source: 'stated' as const }]
        : []),
    ],
    one_time: { counts_pct: percent ? p.one_time_weight : 0, source: 'stated' },
    accelerators:
      p.accelerator_style === 'none'
        ? []
        : [{ threshold: p.accelerator_threshold, rate: p.accelerator_rate }, ...(p.accelerator_steps ?? [])].map((st) => ({
            kind: p.accelerator_style === 'rate_switch' ? 'forward_rate' : 'retroactive_bump',
            starts_at_pct: p.quota > 0 ? round2((st.threshold / p.quota) * 100) : null,
            starts_at_amount: st.threshold,
            rate: st.rate,
            source: 'stated',
          })),
    floors: [],
    discount_rules: [],
    bonuses: p.quarterly_kicker
      ? [
          {
            kind: p.quarterly_kicker.tiers.some(isFixedTier) ? 'attainment_bonus' : 'period_kicker',
            period: 'quarter',
            measure: 'new_arr',
            target_amount: p.quarterly_kicker.target,
            spiff_for: 'not_applicable',
            tiers: p.quarterly_kicker.tiers.map((t) =>
              isFixedTier(t)
                ? { at_pct: t.attainmentPct, pays_pct: null, pays_amount: t.amount as number }
                : { at_pct: t.attainmentPct, pays_pct: t.kickerPct, pays_amount: null },
            ),
            source: 'stated',
          },
        ]
      : [],
    caps: [],
    clawbacks: [],
    draws: [],
    paid_when: 'unknown',
    paid_cadence: 'unknown',
    paid_lag_months: null,
    other_features: [],
    other_note: null,
  };
}

/** A blank record: the starting point when someone skips straight to the form. */
export function emptyRecord(): PlanRecord {
  return {
    format: FORMAT_VERSION,
    role: { level: 'unknown', title: null },
    quota: { period: 'unknown', measure: 'unknown', amount: null, source: 'stated', excludes: [] },
    pay_rules: [],
    one_time: { counts_pct: null, source: 'stated' },
    accelerators: [],
    floors: [],
    discount_rules: [],
    bonuses: [],
    caps: [],
    clawbacks: [],
    draws: [],
    paid_when: 'unknown',
    paid_cadence: 'unknown',
    paid_lag_months: null,
    other_features: [],
    other_note: null,
  };
}

/**
 * Someone described their plan, then adjusted the numbers in the form. The
 * form only knows what the engine runs, so its numbers replace those parts of
 * the record and everything else they described (what doesn't count toward
 * quota, caps, clawbacks, further accelerator steps, other bonuses) is kept.
 */
export function mergeFormIntoRecord(described: PlanRecord, p: CompPlan): PlanRecord {
  const fromForm = recordFromPlan(p);
  const m = mapRecord(described);
  // The form owns the base rate, how one-time counts and hardware's rate.
  const keepRules = described.pay_rules.filter((x, i) => i !== m.baseRule && !['one_time', 'services', 'hardware'].includes(x.applies_to));
  const keepAccels = described.accelerators.filter((_, i) => i !== m.accelRule && !m.stepRules.includes(i));
  const keepBonuses = described.bonuses.filter((_, i) => i !== m.kickerRule);
  const corrected = <T extends { source: Source }>(x: T): T => ({ ...x, source: 'corrected' });
  return {
    ...described,
    role: { level: described.role.level, title: fromForm.role.title ?? described.role.title },
    quota: { ...corrected(fromForm.quota), excludes: described.quota.excludes },
    pay_rules: [...fromForm.pay_rules.map(corrected), ...keepRules],
    one_time: corrected(fromForm.one_time),
    accelerators: [...fromForm.accelerators.map(corrected), ...keepAccels],
    bonuses: [...fromForm.bonuses.map(corrected), ...keepBonuses],
  };
}
