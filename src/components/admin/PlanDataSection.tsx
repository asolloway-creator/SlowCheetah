import { COMPANY_SIZE_BANDS } from '@/lib/calc';
import type { PlanData, Range } from '@/lib/admin';
import {
  CONTEXT_ROLE_LEVELS,
  INDUSTRIES,
  OTE_BANDS,
  REGIONS,
  SEGMENTS,
  TENURE_BANDS,
} from '@/lib/plan-record/schema';
import { GAP_WORDS } from '@/lib/plan-record/copy';
import type { Topic } from '@/lib/plan-record/map';
import { BarList, DailyChart, MixCard, StatTile, Tag } from '@/components/admin/AdminParts';
import { daySeries, when } from '@/components/admin/series';

const PERIOD: Record<string, string> = { month: 'Monthly', quarter: 'Quarterly', half: 'Half-year', year: 'Annual', unknown: 'Unstated' };
const MEASURE: Record<string, string> = {
  new_arr: 'new ARR', acv: 'ACV', first_year_value: 'first-year value', mrr: 'MRR', tcv: 'TCV', bookings: 'bookings',
  revenue: 'revenue', gross_profit: 'gross profit', units: 'units', deals: 'deals', other: 'another measure', unknown: 'an unstated measure',
};
const METHOD: Record<string, string> = {
  percent_of_value: '% of deal', months_of_mrr: 'months of MRR', flat_per_unit: 'flat per unit', flat_per_deal: 'flat per deal',
  percent_of_margin: '% of margin', other: 'other pay', unknown: 'pay unclear',
};
const ACCEL: Record<string, string> = {
  none: 'no accelerator', forward_rate: 'rate goes up', retroactive_rate: 'retro rate', retroactive_bump: 'retro bump',
  marginal_tier: 'marginal tier', unknown: 'accelerator unclear',
};
const LIMIT: Record<string, string> = {
  period_year: 'Annual quota', period_half: 'Half-year quota', measure_tcv: 'Quota on total contract value',
  measure_other: 'Quota on revenue, margin or other', method_flat: 'Flat pay per deal or unit', method_margin: 'Commission on margin',
  method_other: 'Other ways deals pay', basis_tcv: 'Percent of total contract value', basis_other: 'Percent of revenue or margin',
};
const NOTE: Record<string, string> = {
  cap: 'Commission caps', floor: 'Less or no pay below a level', discount_rule: 'Discount rules', more_steps: 'Second accelerator steps',
  marginal_split: 'Marginal accelerators (run close, not exact)', attainment_bonus: 'Fixed attainment bonuses', spiff: 'SPIFFs',
  other_bonus: 'Other bonuses', kicker_not_quarterly: 'Bonuses that aren’t quarterly', kicker_not_arr: 'Bonuses not measured in ARR',
  second_kicker: 'A second periodic bonus', kicker_more_tiers: 'Bonuses with 3+ levels', other_business_rate: 'Different rates by kind of business',
  one_time_above_base: 'One-time charges paid above base', one_time_on_mrr_plan: 'One-time pay on months-of-MRR plans',
  as_quarterly: 'Annual quotas run as quarterly', tcv_as_first_year: 'TCV run as first-year value',
  clawback: 'Clawbacks', draw: 'Draws', paid_when: 'Payment timing',
};
const FEATURE: Record<string, string> = {
  ramp: 'Ramped quotas', deal_splits: 'Split deals', multi_year_credit: 'Multi-year credit', team_bonus: 'Team bonuses',
  mbo: 'Goals-based bonuses', territory_rules: 'Territory rules', overlay: 'Overlay roles', renewal_rules: 'Renewal rules',
  windfall: 'Windfall clauses', other: 'Other features',
};
const CORRECTION: Record<string, string> = {
  'quota.amount': 'Quota amount', 'quota.period': 'Quota period', 'quota.measure': 'What quota counts',
  'pay_rules.rate': 'Base rate', 'pay_rules.method': 'How deals pay', 'pay_rules.value_basis': 'What the percent is of',
  'pay_rules.applies_to': 'Which business a rate covers', 'one_time.counts_pct': 'One-time weight', 'accelerators.kind': 'Accelerator type',
  'accelerators.rate': 'Accelerator rate', 'accelerators.starts_at_pct': 'Where the accelerator starts',
  'accelerators.starts_at_amount': 'Where the accelerator starts', 'bonuses.target_amount': 'Bonus target',
  'bonuses.tiers.at_pct': 'Bonus level', 'bonuses.tiers.pays_pct': 'Bonus size', 'role.title': 'Job title', 'role.level': 'Role',
};
const labels = (pairs: readonly (readonly [string, string])[]) => ({ ...Object.fromEntries(pairs), unset: 'Not given' });
const CONTEXT: [key: string, title: string, names: Record<string, string>][] = [
  ['role_level', 'Role', labels(CONTEXT_ROLE_LEVELS)],
  ['segment', 'Sells to', labels(SEGMENTS)],
  ['industry', 'Industry', labels(INDUSTRIES)],
  ['company_size_band', 'Company size', labels(COMPANY_SIZE_BANDS)],
  ['tenure_band', 'Time in role', labels(TENURE_BANDS)],
  ['region', 'Where', labels(REGIONS)],
  ['ote_band', 'On-target earnings', labels(OTE_BANDS)],
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The plan data set: what people confirmed, as rules and numbers. Shown to
 * you in full; anything published from it needs at least 10 plans per group.
 */
export default function PlanDataSection({ d, range, tz, rangeLabel }: { d: PlanData; range: Range; tz: string; rangeLabel: string }) {
  const buildNext = [
    ...d.limits.map((x) => ({ label: LIMIT[x.limit] ?? x.limit, value: x.n, key: `limit:${x.limit}` })),
    ...d.notYet.filter((x) => x.status !== 'recorded' && x.note !== 'feature').map((x) => ({ label: NOTE[x.note] ?? x.note, value: x.n, key: `note:${x.note}` })),
    ...d.features.map((x) => ({ label: FEATURE[x.feature] ?? x.feature, value: x.n, key: `feature:${x.feature}` })),
  ].sort((a, b) => b.value - a.value);
  const noted = d.notYet.filter((x) => x.status === 'recorded' && x.note !== 'feature');
  const readAccuracy = d.verifiedReads ? Math.round(((d.verifiedReads - d.correctedReads) / d.verifiedReads) * 100) : null;

  return (
    <section className="admin-section" aria-labelledby="plans-h">
      <div className="admin-section-head">
        <h2 id="plans-h" className="admin-h">Plan data</h2>
        <Tag kind="real" />
        <p className="admin-section-note">
          Plans people confirmed, as rules and numbers. One per person, their latest. Never their words, company or deals.
        </p>
      </div>

      <div className="stat-row">
        <StatTile label="People who shared a plan" value={d.people} note="all time" />
        <StatTile label="New" value={d.peopleNew} note={rangeLabel} />
        <StatTile label="IOI can run the numbers" value={d.calculable} note={`of ${d.people}`} />
        <StatTile label="Added context" value={d.withContext} note={`of ${d.people}`} />
        <StatTile
          label="Read right the first time"
          value={readAccuracy === null ? 'None yet' : `${readAccuracy}%`}
          note={d.verifiedReads ? `of ${d.verifiedReads} AI reads, ${rangeLabel}` : 'no AI reads yet'}
        />
      </div>

      {d.people === 0 ? (
        <p className="admin-empty">No plans shared yet. Confirmed plans show up here, with what IOI can’t calculate yet.</p>
      ) : (
        <>
          <div className="admin-grid-2">
            <div className="admin-card">
              <h3 className="admin-h3">What to build next</h3>
              <p className="admin-caption">Things people’s plans have that IOI can’t calculate yet, by how many plans have them.</p>
              <BarList rows={buildNext} emptyText="Everything shared so far, IOI can run." />
              {noted.length > 0 && (
                <p className="admin-caption">
                  Also noted, without changing what a deal pays: {noted.map((x) => `${NOTE[x.note] ?? x.note} (${x.n})`).join(', ')}.
                </p>
              )}
            </div>
            <div className="admin-card">
              <h3 className="admin-h3">Plan shapes</h3>
              <BarList
                rows={d.shapes.map((s) => ({
                  label: `${PERIOD[s.period] ?? s.period} ${MEASURE[s.measure] ?? s.measure}, ${METHOD[s.method] ?? s.method}, ${ACCEL[s.accel] ?? s.accel}`,
                  value: s.n,
                }))}
                emptyText="No shapes yet."
                stacked
              />
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-card">
              <h3 className="admin-h3">Where the reader gets corrected</h3>
              <p className="admin-caption">What people changed after the AI read their plan. {rangeLabel[0]?.toUpperCase()}{rangeLabel.slice(1)}.</p>
              <BarList
                rows={d.corrections.map((c) => ({ label: CORRECTION[c.path] ?? c.path, value: c.n }))}
                emptyText="No corrections yet."
              />
            </div>
            <div className="admin-card">
              <h3 className="admin-h3">Follow-up questions asked</h3>
              <BarList
                rows={Object.entries(
                  d.questions.reduce<Record<string, number>>((m, q) => {
                    const k = cap(GAP_WORDS[q.topic as Topic] ?? q.topic);
                    m[k] = (m[k] ?? 0) + q.n;
                    return m;
                  }, {}),
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, value]) => ({ label, value }))}
                emptyText="No questions asked yet."
              />
            </div>
          </div>

          <div className="admin-card">
            <h3 className="admin-h3">Plans confirmed per day</h3>
            <DailyChart
              points={daySeries(d.daily.map((x) => ({ day: x.day, visitors: x.n })), range, tz)}
              unit="plan"
              emptyText="No plans confirmed in this period."
            />
          </div>

          <h3 className="admin-h3">Context people added</h3>
          <p className="admin-caption">Shown to you in full. Anything published from this needs at least 10 plans in every group.</p>
          <div className="mix-grid">
            {CONTEXT.map(([key, title, names]) => (
              <MixCard
                key={key}
                title={title}
                rows={Object.entries(d.context[key] ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => [names[k] ?? k, n] as [string, number])}
              />
            ))}
          </div>
          <p className="admin-caption">Last plan confirmed {when(d.lastConfirmedAt, tz)}.</p>
        </>
      )}
    </section>
  );
}
