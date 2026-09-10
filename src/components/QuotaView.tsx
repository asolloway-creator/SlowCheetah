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

  // The add-on: what the unattached units are leaving behind.
  const attachUnits = deals.filter((d) => d.attach).reduce((n, d) => n + d.units, 0);
  const nonAttach = units - attachUnits;
  const missedArr = nonAttach * plan.attach_mrr * 12;
  const missedCommission =
    plan.commission_style === 'months_of_mrr'
      ? nonAttach * plan.attach_mrr * plan.base_rate
      : missedArr * (plan.base_rate / 100);
  const missedCredit = plan.quota_basis === 'arr' ? missedArr : 0;
  const wouldBe = ptd.creditBooked + missedCredit;
  const wouldCross = hasAccel && !s.accelerated && wouldBe >= plan.accelerator_threshold;
  const addOn = (plan.attach_name || 'add-on').replace(/^./, (c) => c.toLowerCase());

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
    ...(plan.attach_enabled
      ? [{ label: plan.attach_name || 'Add-on', value: `on ${attachUnits} of ${units} unit${units === 1 ? '' : 's'}` }]
      : []),
  ];

  const attachSentence =
    plan.attach_enabled && !empty && nonAttach > 0
      ? wouldCross
        ? `With the ${addOn} on every unit you’ve sold, this ${noun} would sit at ${fmtCredit(plan, wouldBe)} — past your accelerator${
            retro
              ? `, with ${fmtSigned((plan.accelerator_rate / 100) * (ptd.commissionBooked + missedCommission))} unlocked retroactively`
              : ''
          }.`
        : plan.quota_basis === 'arr'
          ? `With the ${addOn} on every unit you’ve sold, this ${noun} would sit at ${fmtMoney(wouldBe)} of ${fmtMoney(plan.quota)}.`
          : `That’s ${fmtMoney(missedCommission)} of commission this ${noun} from one toggle.`
      : null;

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
          {attachSentence && <p className="quota-attach">{attachSentence}</p>}
        </>
      )}
    </div>
  );
}
