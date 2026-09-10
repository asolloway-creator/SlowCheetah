'use client';

import Link from 'next/link';
import { periodLabel, periodSummary, type CompPlan, type PeriodToDate } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmtCredit, fmtMoney, fmtPctShort, fmtRateShort, fmtSigned, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import Ledger, { type LedgerRow } from '@/components/Ledger';

/** Where you stand: one narrative — a figure, the line, one sentence, a ledger. */
export default function QuotaView({ plan, ptd, deals }: { plan: CompPlan; ptd: PeriodToDate; deals: DealRow[] }) {
  const s = periodSummary(plan, ptd);
  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const retro = plan.accelerator_style === 'retro_bump';
  const hasAccel = plan.accelerator_style !== 'none';
  const empty = deals.length === 0;

  const units = deals.reduce((n, d) => n + d.units, 0);
  const arr = deals.reduce((n, d) => n + d.arr, 0);
  const lost = deals.reduce((n, d) => n + d.money_left_on_table, 0);
  const pct = plan.quota > 0 ? Math.round((ptd.creditBooked / plan.quota) * 100) : 0;

  const sentence = hasAccel
    ? s.accelerated
      ? retro
        ? `You crossed your accelerator. Every deal this ${noun} pays ${fmtPctShort(plan.accelerator_rate)} more — ${fmtMoney(s.acceleratorValue)} so far.`
        : `You’re past your accelerator. Every deal from here earns ${fmtRateShort(plan, plan.accelerator_rate)}.`
      : retro
        ? `Hold the line on the next ${fmtCredit(plan, s.toAccelerator)} and you unlock ${fmtSigned(s.acceleratorValue)} on the deals you’ve already closed.`
        : `${fmtCredit(plan, plan.accelerator_threshold)} land and every deal from there earns ${fmtRateShort(plan, plan.accelerator_rate)} — ${fmtCredit(plan, s.toAccelerator)} to go.`
    : s.attained
      ? 'Quota made. Same rate on every deal.'
      : `${fmtCredit(plan, s.toQuota)} to quota. Same rate on every deal.`;

  const rows: LedgerRow[] = [
    { label: 'Deals booked', value: String(deals.length), suffix: `· ${units} unit${units === 1 ? '' : 's'}` },
    { label: 'New ARR', value: fmtMoney(arr) },
    {
      label: 'Commission so far',
      value: fmtMoney(s.payout),
      suffix:
        s.accelerated && retro
          ? `· includes the +${fmtPctShort(plan.accelerator_rate)} bump`
          : plan.accelerator_style === 'rate_switch' && s.accelerated
            ? '· as booked'
            : `· at ${fmtRateShort(plan, plan.base_rate)}`,
    },
    { label: 'Left on the table', value: lost > 0 ? fmtMoney(lost) : '—', tone: lost > 0 ? 'red' : 'dim' },
  ];

  return (
    <div className="quota">
      <h1 className="page-title">Where you stand in {label}</h1>
      <p className={`quota-figure${s.accelerated ? ' is-green' : ''}`}>{fmtCredit(plan, ptd.creditBooked)}</p>
      <p className="quota-caption">
        {empty
          ? `Nothing booked in ${label} yet.`
          : plan.quota_basis === 'arr'
            ? `booked toward a ${fmtMoney(plan.quota)} quota — ${pct}% there.`
            : `of ${fmtCredit(plan, plan.quota)} — ${pct}% there.`}
      </p>

      <QuotaLine mode="quarter" plan={plan} ptd={ptd} />

      {empty ? (
        <p className="quota-sentence">
          <Link className="btn-text" href="/">
            Enter a deal &rarr;
          </Link>
        </p>
      ) : (
        <>
          <p className="quota-sentence">{sentence}</p>
          <h2 className="section-h">This {noun} so far</h2>
          <Ledger rows={rows} />
        </>
      )}
    </div>
  );
}
