import { calc, type CompPlan, type DealInput } from '@/lib/calc';
import { fmt, fmtMoney, fmtPctShort } from '@/lib/format';
import type { Area, Assumed, Gap, Limit, Mapping, Note, Status, Topic } from './map';
import type { CalcChoices, Measure, Period, PlanRecord, Source } from './schema';

/**
 * Everything a person reads about their own plan, written from the record
 * and never from their words: the readback, follow-up questions, "we
 * assumed" lines, what IOI can't run yet, and one worked example to check
 * against a real paycheck. Deterministic, so the same plan always reads
 * the same way and nothing they typed can leak back out.
 */

// ── Words ───────────────────────────────────────────────────────────────────

const MEASURE_WORDS: Record<Measure, string> = {
  new_arr: 'new ARR',
  acv: 'annual contract value',
  first_year_value: 'first-year contract value',
  mrr: 'new MRR',
  tcv: 'total contract value',
  bookings: 'bookings',
  revenue: 'revenue',
  gross_profit: 'gross profit',
  units: 'units',
  deals: 'deals',
  other: 'another measure',
  unknown: 'an unstated measure',
};
const PER_PERIOD: Record<Period, string> = {
  month: 'a month',
  quarter: 'a quarter',
  half: 'every six months',
  year: 'a year',
  unknown: '',
};
const PERIOD_NOUN: Record<Period, string> = {
  month: 'month',
  quarter: 'quarter',
  half: 'half-year',
  year: 'year',
  unknown: 'period',
};
const BASIS_WORDS: Record<PlanRecord['pay_rules'][number]['value_basis'], string> = {
  arr: 'its ARR',
  acv: 'its annual contract value',
  first_year_value: 'its first-year value',
  mrr: 'its monthly value',
  tcv: 'its total contract value',
  revenue: 'its revenue',
  margin: 'its margin',
  not_applicable: 'its value',
  unknown: 'its value',
};
const SCOPE_WORDS: Record<PlanRecord['pay_rules'][number]['applies_to'], string> = {
  all: 'Each deal pays',
  new_business: 'New business pays',
  recurring: 'Subscription revenue pays',
  expansion: 'Expansion deals pay',
  renewal: 'Renewals pay',
  one_time: 'One-time charges pay',
  other: 'Some deals pay',
};
const SPIFF_WORDS: Record<PlanRecord['bonuses'][number]['spiff_for'], string> = {
  product: 'selling a particular product',
  multi_year: 'multi-year deals',
  prepay: 'prepaid deals',
  new_logo: 'new customers',
  activity: 'a particular activity',
  other: 'something specific',
  not_applicable: 'something specific',
};
const FEATURE_WORDS: Record<PlanRecord['other_features'][number], string> = {
  ramp: 'A ramped quota while you’re new',
  deal_splits: 'Deals split with teammates',
  multi_year_credit: 'Extra credit for multi-year deals',
  team_bonus: 'A team bonus',
  mbo: 'A goals-based bonus',
  territory_rules: 'Territory rules',
  overlay: 'An overlay role',
  renewal_rules: 'Separate rules for renewals',
  windfall: 'A limit on unusually large deals',
  other: 'Something else we noted',
};
const PAID_WHEN_WORDS: Record<PlanRecord['paid_when'], string> = {
  booking: 'Commission is paid when a deal is booked.',
  invoice: 'Commission is paid when the customer is invoiced.',
  collection: 'Commission is paid when the customer pays.',
  go_live: 'Commission is paid when the customer goes live.',
  other: 'Commission is paid on a schedule of its own.',
  unknown: '',
};

const PERIOD_ADJ: Record<Period, string> = {
  month: 'a monthly',
  quarter: 'a quarterly',
  half: 'a half-year',
  year: 'an annual',
  unknown: 'a',
};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const isCount = (m: Measure) => m === 'units' || m === 'deals';
const plural = (n: number, one: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one.replace(/s$/, '') : one}`;

function quotaAmount(r: PlanRecord, n: number): string {
  const m = r.quota.measure;
  if (isCount(m)) return plural(n, MEASURE_WORDS[m]);
  return `${fmt(n)} of ${MEASURE_WORDS[m]}`;
}

/** "100% of quota" or "$100,000" or "8 units". */
function startWords(r: PlanRecord, a: PlanRecord['accelerators'][number]): string {
  if (a.starts_at_amount !== null) {
    return isCount(r.quota.measure) ? plural(a.starts_at_amount, MEASURE_WORDS[r.quota.measure]) : fmt(a.starts_at_amount);
  }
  if (a.starts_at_pct !== null) return `${fmtPctShort(a.starts_at_pct)} of quota`;
  return 'a point it didn’t say';
}

/** A rate in the base rule's own unit: "15%", "3 months of MRR", "$500". */
function rateWords(r: PlanRecord, rate: number, baseRule: number | null): string {
  const method = baseRule !== null ? r.pay_rules[baseRule]?.method : 'percent_of_value';
  if (method === 'months_of_mrr') return `${rate} month${rate === 1 ? '' : 's'} of MRR`;
  if (method === 'flat_per_deal' || method === 'flat_per_unit') return fmtMoney(rate);
  return fmtPctShort(rate);
}

// ── Readback ────────────────────────────────────────────────────────────────

export type ReadbackLine = { area: Area; index: number; text: string; status: Status; note: Note | null };
export type ReadbackGroup = { title: string; lines: ReadbackLine[] };

export function readback(r: PlanRecord, m: Mapping): ReadbackGroup[] {
  const statusOf = (area: Area, index: number) => m.coverage.find((c) => c.area === area && c.index === index);
  const line = (area: Area, index: number, text: string): ReadbackLine => {
    const c = statusOf(area, index);
    return { area, index, text, status: c?.status ?? 'calculated', note: c && c.status !== 'calculated' ? c.note : null };
  };

  const quota: ReadbackLine[] = [];
  if (r.quota.amount !== null && r.quota.measure !== 'unknown') {
    quota.push(line('quota', 0, `Your quota is ${quotaAmount(r, r.quota.amount)} ${PER_PERIOD[r.quota.period]}.`.replace(' .', '.')));
  } else if (r.quota.measure !== 'unknown') {
    quota.push(line('quota', 0, `Your quota counts ${MEASURE_WORDS[r.quota.measure]}.`));
  }

  const pay: ReadbackLine[] = r.pay_rules.map((p, i) => {
    const scope = SCOPE_WORDS[p.applies_to];
    let text: string;
    if (p.method === 'percent_of_value' && p.applies_to === 'one_time') {
      text = p.rate !== null ? `${scope} ${fmtPctShort(p.rate)}.` : `${scope} a percent.`;
    } else if (p.method === 'percent_of_value') {
      text = p.rate !== null ? `${scope} ${fmtPctShort(p.rate)} of ${BASIS_WORDS[p.value_basis]}.` : `${scope} a percent of ${BASIS_WORDS[p.value_basis]}.`;
    } else if (p.method === 'months_of_mrr') {
      text = p.rate !== null ? `${scope} ${p.rate} month${p.rate === 1 ? '' : 's'} of its MRR.` : `${scope} a number of months of its MRR.`;
    } else if (p.method === 'flat_per_deal') {
      text = p.rate !== null ? `${scope} a flat ${fmtMoney(p.rate)}.` : `${scope} a flat amount.`;
    } else if (p.method === 'flat_per_unit') {
      text = p.rate !== null ? `Each unit pays a flat ${fmtMoney(p.rate)}.` : 'Each unit pays a flat amount.';
    } else if (p.method === 'percent_of_margin') {
      text = p.rate !== null ? `${scope} ${fmtPctShort(p.rate)} of its margin.` : `${scope} a percent of its margin.`;
    } else {
      text = `${scope} in a way we couldn’t pin down.`;
    }
    return line('pay_rules', i, text);
  });
  const ot = r.one_time.counts_pct;
  const payingOnOneTime = r.pay_rules.some((p) => p.applies_to === 'one_time');
  if (ot !== null && !payingOnOneTime) {
    pay.push(
      line(
        'one_time',
        0,
        ot === 0
          ? 'One-time charges like setup fees don’t count.'
          : ot >= 100
            ? 'One-time charges like setup fees count in full.'
            : `One-time charges like setup fees count at ${fmtPctShort(ot)}.`,
      ),
    );
  }

  const more: ReadbackLine[] = [];
  const noun = PERIOD_NOUN[r.quota.period];
  r.accelerators.forEach((a, i) => {
    const at = startWords(r, a);
    const rate = a.rate !== null ? rateWords(r, a.rate, m.baseRule) : null;
    const text =
      a.kind === 'forward_rate'
        ? `Past ${at}, that deal and every deal after it pays ${rate ?? 'more'}.`
        : a.kind === 'retroactive_rate'
          ? `Past ${at}, every deal that ${noun} is repaid at ${rate ?? 'a higher rate'}, earlier ones included.`
          : a.kind === 'retroactive_bump'
            ? `Past ${at}, the whole ${noun}’s commission goes up ${a.rate !== null ? fmtPctShort(a.rate) : 'by a percent'}, earlier deals included.`
            : a.kind === 'marginal_tier'
              ? `Past ${at}, what you sell above that line pays ${rate ?? 'more'}.`
              : rate
                ? `Past ${at}, deals pay ${rate}.`
                : `An accelerator starts at ${at}.`;
    more.push(line('accelerators', i, text));
  });
  r.floors.forEach((f, i) => {
    const below = f.below_pct !== null ? `${fmtPctShort(f.below_pct)} of quota` : 'a minimum';
    more.push(
      line(
        'floors',
        i,
        f.kind === 'no_commission_below'
          ? `Below ${below}, deals don’t pay commission.`
          : `Below ${below}, deals pay ${f.rate !== null ? rateWords(r, f.rate, m.baseRule) : 'less'}.`,
      ),
    );
  });
  r.discount_rules.forEach((d, i) => {
    const over = d.over_pct !== null ? `over ${fmtPctShort(d.over_pct)}` : 'past a limit';
    const what =
      d.effect === 'no_commission'
        ? 'pay no commission'
        : d.effect === 'reduced_rate'
          ? `pay ${d.rate !== null ? rateWords(r, d.rate, m.baseRule) : 'a lower rate'}`
          : d.effect === 'approval_only'
            ? 'need approval'
            : 'follow a separate rule';
    more.push(line('discount_rules', i, `Deals discounted ${over} ${what}.`));
  });

  const extra: ReadbackLine[] = r.bonuses.map((b, i) => {
    const tiers = b.tiers.filter((t) => t.at_pct !== null);
    if (b.kind === 'period_kicker') {
      const bp = b.period === 'unknown' ? r.quota.period : b.period;
      const on = b.target_amount !== null ? ` on a ${fmt(b.target_amount)} target` : '';
      const pays = (t: (typeof tiers)[number]) => (t.pays_pct !== null ? fmtPctShort(t.pays_pct) : 'by a percent');
      const parts = tiers.map((t, k) =>
        k === 0
          ? `hit ${fmtPctShort(t.at_pct as number)} and the ${PERIOD_NOUN[bp]}’s commission goes up ${pays(t)}`
          : `hit ${fmtPctShort(t.at_pct as number)} and it goes up ${pays(t)}`,
      );
      return line('bonuses', i, parts.length ? `${capital(PERIOD_ADJ[bp])} bonus${on}: ${parts.join(', ')}.` : `${capital(PERIOD_ADJ[bp])} bonus on your commission.`);
    }
    if (b.kind === 'attainment_bonus') {
      const parts = tiers.map((t) => `${t.pays_amount !== null ? fmtMoney(t.pays_amount) : 'a bonus'} at ${fmtPctShort(t.at_pct as number)} of quota`);
      return line('bonuses', i, parts.length ? `A fixed bonus: ${parts.join('; ')}.` : 'A fixed bonus for hitting attainment levels.');
    }
    if (b.kind === 'spiff') {
      const amt = b.tiers[0]?.pays_amount;
      return line('bonuses', i, `A bonus for ${SPIFF_WORDS[b.spiff_for]}${amt !== null && amt !== undefined ? `: ${fmtMoney(amt)}` : ''}.`);
    }
    return line('bonuses', i, 'Another bonus on top of commission.');
  });

  const limits: ReadbackLine[] = [];
  r.caps.forEach((c, i) =>
    limits.push(
      line(
        'caps',
        i,
        c.kind === 'per_deal'
          ? `Each deal’s commission is capped${c.amount !== null ? ` at ${fmtMoney(c.amount)}` : ''}.`
          : c.pct_of_target !== null
            ? `Commission stops at ${fmtPctShort(c.pct_of_target)} of target.`
            : `Commission is capped${c.amount !== null ? ` at ${fmtMoney(c.amount)}` : ''}.`,
      ),
    ),
  );
  r.clawbacks.forEach((c, i) =>
    limits.push(
      line(
        'clawbacks',
        i,
        `If a customer cancels${c.within_months !== null ? ` within ${plural(c.within_months, 'months')}` : ''}, ${c.share_pct !== null && c.share_pct < 100 ? `${fmtPctShort(c.share_pct)} of ` : ''}the commission comes back.`,
      ),
    ),
  );
  r.draws.forEach((d, i) =>
    limits.push(
      line(
        'draws',
        i,
        `${d.kind === 'non_recoverable' ? 'A non-recoverable' : d.kind === 'recoverable' ? 'A recoverable' : 'A'} draw${d.monthly_amount !== null ? ` of ${fmtMoney(d.monthly_amount)} a month` : ''}${d.months !== null ? ` for ${plural(d.months, 'months')}` : ''}.`,
      ),
    ),
  );
  if (r.paid_when !== 'unknown') limits.push(line('paid_when', 0, PAID_WHEN_WORDS[r.paid_when]));
  r.other_features.forEach((f, i) => limits.push(line('other_features', i, `${FEATURE_WORDS[f]}.`)));

  return [
    { title: 'Quota', lines: quota },
    { title: 'Each deal', lines: pay },
    { title: 'As you sell more', lines: more },
    { title: 'Bonuses', lines: extra },
    { title: 'Limits and timing', lines: limits },
  ].filter((g) => g.lines.length > 0);
}

/** One plain sentence on how a rule falls short in IOI's math. */
export const NOTE_TEXT: Record<Note, string> = {
  exact: '',
  mrr_quota_as_arr: '',
  mrr_rate_as_annual: '',
  as_quarterly: 'Run as a quarterly quota, so accelerators reset every quarter. Yours don’t.',
  tcv_as_first_year: 'Run on first-year value, so multi-year deals read lower than your plan pays.',
  one_time_from_rates: '',
  one_time_above_base: 'IOI can’t pay one-time charges above your base rate yet.',
  one_time_on_mrr_plan: 'IOI’s months-of-MRR math doesn’t pay on one-time charges yet.',
  other_business_rate: 'IOI treats every deal as new business for now.',
  marginal_split: 'IOI pays the deal that crosses the line fully at the new rate. Your plan splits that one deal.',
  more_steps: 'IOI runs your first step only, so pay past this point will read low.',
  floor: 'Deals below that line will read high here.',
  discount_rule: 'Deeply discounted deals will read high here.',
  kicker_more_tiers: 'IOI runs your first two bonus levels.',
  kicker_not_quarterly: 'IOI runs quarterly bonuses only for now.',
  kicker_not_arr: 'IOI runs bonuses measured in ARR only for now.',
  second_kicker: 'IOI runs one quarterly bonus at a time for now.',
  attainment_bonus: '',
  spiff: '',
  other_bonus: '',
  cap: 'Pay above the cap will read high here.',
  clawback: '',
  draw: '',
  paid_when: '',
  feature: '',
};

export const STATUS_LABEL: Record<Status, string> = {
  calculated: '',
  approximated: 'Close, not exact',
  not_yet: 'Not in the numbers yet',
  recorded: 'Noted',
};

// ── Limits: described, but the engine can't run it ─────────────────────────

export type LimitCopy = {
  title: string;
  body: string;
  /** A conversion the person can choose, when there's an honest one. */
  choice: { label: string; key: keyof CalcChoices } | null;
};

export function limitCopy(limit: Limit, r: PlanRecord): LimitCopy {
  const amount = r.quota.amount;
  switch (limit) {
    case 'period_year':
    case 'period_half': {
      const half = limit === 'period_half';
      const q = amount !== null ? quotaAmount(r, Math.round(amount / (half ? 2 : 4))) : null;
      return {
        title: `IOI doesn’t run ${half ? 'half-year' : 'annual'} quotas yet.`,
        body: `Your plan is saved as ${half ? 'half-yearly' : 'annual'}. To see numbers now, run it as a quarterly quota${q ? ` of ${q}` : ''}. Accelerators would then reset every quarter, which yours don’t.`,
        choice: { label: 'Run it quarterly', key: 'as_quarterly' },
      };
    }
    case 'measure_tcv':
    case 'basis_tcv':
      return {
        title: 'IOI works in first-year value today.',
        body: 'Your plan counts total contract value. To see numbers now, treat it as first-year value. Multi-year deals will read lower than your plan pays.',
        choice: { label: 'Use first-year value', key: 'tcv_as_first_year' },
      };
    case 'measure_other':
      return {
        title: `IOI can’t run quotas on ${MEASURE_WORDS[r.quota.measure]} yet.`,
        body: 'Your plan is saved as described. You can still set rough numbers yourself with the form.',
        choice: null,
      };
    case 'method_flat':
      return {
        title: 'IOI can’t run flat per-deal pay yet.',
        body: 'Your plan is saved as described. You can still set rough numbers yourself with the form.',
        choice: null,
      };
    case 'method_margin':
    case 'basis_other':
      return {
        title: 'IOI can’t run commission on margin or revenue yet.',
        body: 'Your plan is saved as described. You can still set rough numbers yourself with the form.',
        choice: null,
      };
    default:
      return {
        title: 'IOI couldn’t match how your deals pay to its math yet.',
        body: 'Your plan is saved as described. You can still set rough numbers yourself with the form.',
        choice: null,
      };
  }
}

// ── Questions and fixes ─────────────────────────────────────────────────────

export type Choice = { value: string; label: string };
export type Question =
  | { topic: Topic; index: number; kind: 'choice'; prompt: string; choices: Choice[]; current: string | null }
  | {
      topic: Topic;
      index: number;
      kind: 'number';
      prompt: string;
      prefix?: string;
      suffix?: string;
      current: number | null;
      max: number;
    };

function baseOf(r: PlanRecord, index: number) {
  return r.pay_rules[index] ?? null;
}

export function question(r: PlanRecord, topic: Topic, index: number): Question {
  const money = !isCount(r.quota.measure);
  const base = baseOf(r, index);
  const months = base?.method === 'months_of_mrr';
  switch (topic) {
    case 'quota_period':
      return {
        topic, index, kind: 'choice', prompt: 'How often does your quota reset?', current: r.quota.period === 'unknown' ? null : r.quota.period,
        choices: [
          { value: 'month', label: 'Every month' },
          { value: 'quarter', label: 'Every quarter' },
          { value: 'half', label: 'Every six months' },
          { value: 'year', label: 'Every year' },
        ],
      };
    case 'quota_measure':
      return {
        topic, index, kind: 'choice', prompt: 'What counts toward your quota?', current: ['unknown', 'bookings'].includes(r.quota.measure) ? null : r.quota.measure,
        choices: [
          { value: 'new_arr', label: 'New ARR' },
          { value: 'first_year_value', label: 'First-year contract value' },
          { value: 'tcv', label: 'Total contract value' },
          { value: 'mrr', label: 'New MRR' },
          { value: 'deals', label: 'Number of deals' },
          { value: 'units', label: 'Number of units' },
          { value: 'revenue', label: 'Revenue' },
        ],
      };
    case 'quota_amount':
      return {
        topic, index, kind: 'number', current: r.quota.amount, max: money ? 1e9 : 100000,
        prompt: `What’s your quota for one ${PERIOD_NOUN[r.quota.period]}?`,
        ...(money ? { prefix: '$' } : { suffix: MEASURE_WORDS[r.quota.measure] === 'deals' ? 'deals' : 'units' }),
      };
    case 'base_method':
      return {
        topic, index, kind: 'choice', prompt: 'How does a deal pay you?', current: base && base.method !== 'unknown' ? base.method : null,
        choices: [
          { value: 'percent_of_value', label: 'A percent of the deal' },
          { value: 'months_of_mrr', label: 'Months of MRR' },
          { value: 'flat_per_deal', label: 'A flat amount per deal' },
        ],
      };
    case 'base_basis':
      return {
        topic, index, kind: 'choice', prompt: 'Your percent is taken of what?', current: base && base.value_basis !== 'unknown' ? base.value_basis : null,
        choices: [
          { value: 'first_year_value', label: 'First-year value' },
          { value: 'arr', label: 'ARR' },
          { value: 'tcv', label: 'Total contract value' },
          { value: 'mrr', label: 'Monthly value' },
        ],
      };
    case 'base_rate':
      return {
        topic, index, kind: 'number', current: base?.rate ?? null, max: months ? 36 : 100,
        prompt: 'What does a deal pay before any accelerator?',
        suffix: months ? 'months of MRR' : '%',
      };
    case 'one_time_weight':
      return {
        topic, index, kind: 'number', current: r.one_time.counts_pct, max: 100, suffix: '%',
        prompt: 'How much do one-time charges like setup fees count? 0% if not at all, 100% if in full.',
      };
    case 'accelerator_kind':
      return {
        topic, index, kind: 'choice', prompt: 'Once you pass your accelerator, what pays more?',
        current: r.accelerators[index] && r.accelerators[index].kind !== 'unknown' ? r.accelerators[index].kind : null,
        choices: [
          { value: 'forward_rate', label: 'That deal and every deal after it' },
          { value: 'retroactive_rate', label: 'Every deal that period, earlier ones included' },
          { value: 'retroactive_bump', label: 'The whole period’s commission gets a percent boost' },
        ],
      };
    case 'accelerator_start':
      return {
        topic, index, kind: 'number', current: r.accelerators[index]?.starts_at_pct ?? null, max: 1000, suffix: '% of quota',
        prompt: 'Where does your accelerator start?',
      };
    case 'accelerator_rate': {
      const bump = r.accelerators[index]?.kind === 'retroactive_bump';
      return {
        topic, index, kind: 'number', current: r.accelerators[index]?.rate ?? null,
        max: bump ? 1000 : months ? 36 : 100,
        prompt: bump ? 'How big is the boost?' : 'What’s the rate past that point?',
        suffix: bump ? '%' : months ? 'months of MRR' : '%',
      };
    }
    case 'kicker_target':
      return {
        topic, index, kind: 'number', current: r.bonuses[index]?.target_amount ?? null, max: 1e9, prefix: '$',
        prompt: 'What’s the quarterly target your bonus is measured against?',
      };
    case 'kicker_start':
      return {
        topic, index, kind: 'number', current: r.bonuses[index]?.tiers[0]?.at_pct ?? null, max: 1000, suffix: '% of target',
        prompt: 'What attainment unlocks the bonus?',
      };
    case 'kicker_pay':
      return {
        topic, index, kind: 'number', current: r.bonuses[index]?.tiers[0]?.pays_pct ?? null, max: 200, suffix: '%',
        prompt: 'How much does it add to that quarter’s commission?',
      };
  }
}

/** The questions to show for a fix: some facts come as a set. */
export function fixQuestions(r: PlanRecord, a: Assumed): Question[] {
  if (a.topic === 'quota_period') {
    return (['quota_period', 'quota_measure', 'quota_amount'] as Topic[]).map((t) => question(r, t, 0));
  }
  if (a.topic === 'base_rate') return [question(r, 'base_method', a.index), question(r, 'base_rate', a.index)];
  if (a.topic === 'accelerator_kind') {
    return (['accelerator_kind', 'accelerator_start', 'accelerator_rate'] as Topic[]).map((t) => question(r, t, a.index));
  }
  if (a.topic === 'kicker_pay') {
    return (['kicker_target', 'kicker_start', 'kicker_pay'] as Topic[]).map((t) => question(r, t, a.index));
  }
  return [question(r, a.topic, a.index)];
}

/** The record with one answer applied. Pure: returns a new record. */
export function applyAnswer(r: PlanRecord, topic: Topic, index: number, value: string | number, how: Source): PlanRecord {
  const next: PlanRecord = structuredClone(r);
  const num = typeof value === 'number' ? value : Number(value);
  const ensureBase = () => {
    if (!next.pay_rules[index]) {
      next.pay_rules.push({ applies_to: 'all', method: 'unknown', value_basis: 'unknown', rate: null, source: how });
      return next.pay_rules.length - 1;
    }
    return index;
  };
  const ensureTier = (b: PlanRecord['bonuses'][number]) => {
    if (!b.tiers[0]) b.tiers.push({ at_pct: null, pays_pct: null, pays_amount: null });
    return b.tiers[0];
  };
  switch (topic) {
    case 'quota_period':
      next.quota.period = value as PlanRecord['quota']['period'];
      next.quota.source = how;
      break;
    case 'quota_measure':
      next.quota.measure = value as PlanRecord['quota']['measure'];
      next.quota.source = how;
      break;
    case 'quota_amount':
      next.quota.amount = num;
      next.quota.source = how;
      break;
    case 'base_method': {
      const i = ensureBase();
      const rule = next.pay_rules[i];
      rule.method = value as PlanRecord['pay_rules'][number]['method'];
      if (rule.method !== 'percent_of_value') rule.value_basis = 'not_applicable';
      else if (rule.value_basis === 'not_applicable') rule.value_basis = 'unknown';
      rule.source = how;
      break;
    }
    case 'base_basis': {
      const rule = next.pay_rules[ensureBase()];
      rule.value_basis = value as PlanRecord['pay_rules'][number]['value_basis'];
      rule.source = how;
      break;
    }
    case 'base_rate': {
      const rule = next.pay_rules[ensureBase()];
      rule.rate = num;
      rule.source = how;
      break;
    }
    case 'one_time_weight':
      next.one_time = { counts_pct: num, source: how };
      break;
    case 'accelerator_kind':
    case 'accelerator_start':
    case 'accelerator_rate': {
      const a = next.accelerators[index];
      if (!a) break;
      if (topic === 'accelerator_kind') a.kind = value as PlanRecord['accelerators'][number]['kind'];
      if (topic === 'accelerator_start') {
        a.starts_at_pct = num;
        a.starts_at_amount = null;
      }
      if (topic === 'accelerator_rate') a.rate = num;
      a.source = how;
      break;
    }
    case 'kicker_target':
    case 'kicker_start':
    case 'kicker_pay': {
      const b = next.bonuses[index];
      if (!b) break;
      if (topic === 'kicker_target') b.target_amount = num;
      if (topic === 'kicker_start') ensureTier(b).at_pct = num;
      if (topic === 'kicker_pay') ensureTier(b).pays_pct = num;
      b.source = how;
      break;
    }
  }
  return next;
}

/** "We assumed ..." for one number-changing guess. */
export function assumedText(r: PlanRecord, a: Assumed, m: Mapping): string {
  switch (a.topic) {
    case 'quota_period':
      return r.quota.amount !== null
        ? `We read your quota as ${quotaAmount(r, r.quota.amount)} ${PER_PERIOD[r.quota.period]}.`.replace(' .', '.')
        : 'We read your quota from context.';
    case 'base_basis': {
      const rate = r.pay_rules[a.index]?.rate;
      return `We took your ${rate !== null && rate !== undefined ? fmtPctShort(rate) : 'percent'} as a share of each deal’s first-year value.`;
    }
    case 'base_rate':
      return 'We read your base pay from context.';
    case 'one_time_weight':
      return a.why === 'default'
        ? 'You didn’t mention one-time charges like setup fees, so we counted them at 0%.'
        : `We counted one-time charges like setup fees at ${fmtPctShort(r.one_time.counts_pct ?? 0)}.`;
    case 'accelerator_kind':
      return 'We read how your accelerator applies from context.';
    case 'kicker_target': {
      const t = m.plan?.quarterly_kicker?.target;
      return `We measured your bonus against your quarterly quota${t ? `, ${fmt(t)}` : ''}.`;
    }
    case 'kicker_pay':
      return 'We read your bonus levels from context.';
    default:
      return 'We filled this in from context.';
  }
}

/** Plain words for what's still missing, for the "tell us a bit more" state. */
export const GAP_WORDS: Record<Topic, string> = {
  quota_period: 'how often your quota resets',
  quota_measure: 'what counts toward quota',
  quota_amount: 'your quota amount',
  base_method: 'how a deal pays you',
  base_basis: 'what your percent is taken of',
  base_rate: 'your base rate',
  one_time_weight: 'how one-time charges count',
  accelerator_kind: 'how your accelerator applies',
  accelerator_start: 'where your accelerator starts',
  accelerator_rate: 'your accelerated rate',
  kicker_target: 'your bonus target',
  kicker_start: 'what unlocks your bonus',
  kicker_pay: 'what your bonus adds',
};

export const gapsToAsk = (gaps: Gap[]) => gaps.slice(0, 2);

// ── Worked example ──────────────────────────────────────────────────────────

export type WorkedExample = {
  /** "a $20,000 first-year deal" */
  deal: string;
  before: number;
  /** What the same deal pays once the accelerator is behind you. */
  after: number | null;
  afterNote: string | null;
  oneTime: { amount: number; adds: number } | null;
};

const nice = (n: number) => {
  if (n <= 0) return 0;
  const mag = 10 ** Math.floor(Math.log10(n));
  return Math.max(1000, Math.round(n / (mag / 2)) * (mag / 2));
};

export function workedExample(plan: CompPlan): WorkedExample {
  const zero = { creditBooked: 0, commissionBooked: 0, earnedBooked: 0 };
  let deal: DealInput;
  let label: string;
  if (plan.quota_basis === 'arr') {
    const annual = nice(plan.quota * (plan.period === 'quarter' ? 0.2 : 0.25));
    deal = { oneTime: 0, subscription: annual, subMode: 'acv', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 };
    label = `a deal worth ${fmt(annual)} a year`;
  } else {
    deal = { oneTime: 0, subscription: 1000, subMode: 'mrr', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 };
    label = 'a one-unit deal at $1,000 a month';
  }
  const before = calc(plan, deal, zero).commissionEffective;

  let after: number | null = null;
  let afterNote: string | null = null;
  if (plan.accelerator_style !== 'none') {
    const past = { creditBooked: plan.accelerator_threshold, commissionBooked: 0, earnedBooked: 0 };
    after = calc(plan, deal, past).commissionEffective;
    if (plan.accelerator_style === 'retro_bump') {
      afterNote = `and every earlier deal that ${plan.period} goes up ${fmtPctShort(plan.accelerator_rate)} too`;
    }
  }

  let oneTime: WorkedExample['oneTime'] = null;
  if (plan.commission_style === 'percent' && plan.one_time_weight > 0) {
    const amount = 2000;
    const withSetup = calc(plan, { ...deal, oneTime: amount }, zero).commissionEffective;
    oneTime = { amount, adds: withSetup - before };
  }
  return { deal: label, before, after, afterNote, oneTime };
}
