'use client';

import type { CSSProperties, ReactNode } from 'react';
import { isFixedTier, quarterlyKickerSummary, type CompPlan, type QuarterlyKickerTier, type QuarterToDate } from '@/lib/calc';
import type { QuarterView } from '@/lib/rollover';
import { tierName } from '@/components/opening';
import { fmt, fmtMoney, fmtPctShort } from '@/lib/format';

const pct = (f: number) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`;
const vars = (o: Record<string, string>) => o as CSSProperties;

/**
 * The quarter as one timeline: the Quarterly Bonus and how far to it, with
 * the track split into the quarter's three months (each a third of the way
 * to the goal) and filled by what each month booked. It's the one number
 * that carries across a month line, so last month's result and this month's
 * live one sit on the same bar. `recap` is the first-week line about the
 * month just ended, which belongs under it.
 */
export default function QuarterStrip({
  plan,
  qtd,
  quarter,
  quarterDaysLeft,
  recap,
}: {
  plan: CompPlan;
  qtd: QuarterToDate;
  quarter: QuarterView;
  quarterDaysLeft: number;
  recap?: ReactNode;
}) {
  const kicker = plan.quarterly_kicker!;
  const s = quarterlyKickerSummary(plan, qtd);
  if (!s) return null;
  const tiers = [...kicker.tiers].sort((a, b) => a.attainmentPct - b.attainmentPct);
  const name = (t: QuarterlyKickerTier) => tierName(tiers.indexOf(t) + 1);
  const shown = s.tier ?? s.nextTier ?? tiers[0];
  const value = s.tier
    ? fmtMoney(s.bumpValue)
    : isFixedTier(shown)
      ? fmtMoney(shown.amount as number)
      : `+${fmtPctShort(shown.kickerPct)}`;
  const goalTier = s.nextTier ?? shown;
  // The track runs to the bonus line, in dollars of new ARR.
  const goal = (kicker.target * goalTier.attainmentPct) / 100;
  const third = goal / 3;
  const note = s.tier
    ? `Locked in${s.nextTier ? `. ${fmt(s.toNextTierArr)} more new ARR reaches the ${name(s.nextTier)}` : ''}`
    : `${fmt(s.toNextTierArr)} more new ARR to unlock it`;

  // The pace to the next tier by quarter end, against a monthly quota when
  // the plan has one in the same currency.
  let pace: string | null = null;
  if (s.nextTier && s.toNextTierArr > 0 && quarterDaysLeft > 0) {
    const months = Math.max(quarterDaysLeft / 30.44, 1 / 30.44);
    const perMonth = s.toNextTierArr / months;
    const ofQuota =
      plan.period === 'month' && plan.quota_basis === 'arr' && plan.quota > 0 ? ` (${Math.round((perMonth / plan.quota) * 100)}% of your monthly quota)` : '';
    pace =
      quarterDaysLeft <= 31
        ? `${quarterDaysLeft} day${quarterDaysLeft === 1 ? '' : 's'} left in the quarter.`
        : `About ${fmt(perMonth)} a month to get there by quarter end${ofQuota}.`;
  }

  // What each part of the bar is, in the order it's laid down.
  const parts = [
    ...(quarter.before > 0 ? [{ key: 'before', cls: 'is-before', arr: quarter.before }] : []),
    ...quarter.months.map((m) => ({ key: m.key, cls: m.state === 'now' ? 'is-now' : 'is-past', arr: m.arr })),
  ];

  return (
    <section className={`qs${s.tier ? ' is-won' : ''}`} aria-labelledby="qs-h">
      <header className="qs-head">
        <div>
          <p className="app-label" id="qs-h">
            {quarter.label} · {name(shown)}
          </p>
          <p className="qs-value">{value}</p>
        </div>
        <div className="qs-notes">
          <p className="kpi-note">{note}</p>
          {pace && <p className="kpi-note kpi-pace">{pace}</p>}
        </div>
      </header>

      <div
        className="qs-track"
        role="img"
        aria-label={`${quarter.months.map((m) => `${m.label} ${fmt(m.arr)}`).join(', ')}. ${fmtPctShort(Math.round(s.attainmentPct * 10) / 10)} of the bonus target.`}
      >
        {parts.map((p) => (
          <span key={p.key} className={`qs-seg ${p.cls}`} style={vars({ '--w': pct(goal > 0 ? p.arr / goal : 0) })} />
        ))}
      </div>

      <ol className="qs-months">
        {quarter.months.map((m) => (
          <li key={m.key} className={`qs-month is-${m.state}`} aria-current={m.state === 'now' ? 'date' : undefined}>
            <span className="qs-m-name">{m.label}</span>
            <span className="qs-m-arr">{m.state === 'ahead' ? 'Ahead' : fmt(m.arr)}</span>
            <span className="qs-m-note">{monthNote(m.state, m.arr, third)}</span>
          </li>
        ))}
      </ol>
      {quarter.before > 0 && <p className="qs-before">Includes {fmt(quarter.before)} you booked before IOI.</p>}
      {recap}
    </section>
  );
}

/** One line under a month: where it stands against a third of the way to the bonus. */
function monthNote(state: 'past' | 'now' | 'ahead', arr: number, third: number): string {
  if (state === 'ahead') return 'Still to come';
  if (state === 'now') return arr > 0 ? 'So far' : 'Nothing booked yet';
  const d = arr - third;
  if (Math.abs(d) < 1) return 'Right on bonus pace';
  return d > 0 ? `${fmt(d)} ahead of bonus pace` : `${fmt(-d)} behind bonus pace`;
}
