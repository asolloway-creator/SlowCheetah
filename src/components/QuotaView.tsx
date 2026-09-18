'use client';

import Link from 'next/link';
import { periodLabel, periodSummary, type CompPlan, type PeriodToDate } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmtCredit, fmtMoney, fmtPctShort, fmtRateShort, fmtSigned, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import Ledger, { type LedgerRow } from '@/components/Ledger';

/** Where you stand: one narrative — a figure, the line, one sentence, a ledger. */
export default function QuotaView({
  plan,
  ptd,
  deals,
  demo,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  deals: DealRow[];
  /** Second, lighter touch of the same plan-bridge the deal page makes —
   *  this is where a demo visitor lands right after booking, looking at a
   *  real ledger of sample numbers. Never shown signed in, and the caller
   *  (DemoViews.tsx) only passes it true while still on the stock plan —
   *  same "already made this connection" suppression the deal page's own
   *  bridges use, via planSaved there. */
  demo?: boolean;
}) {
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
    {
      label: 'Deals booked',
      value: `${deals.length} deal${deals.length === 1 ? '' : 's'}`,
      suffix: `· ${units} unit${units === 1 ? '' : 's'}`,
    },
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
    // Each deal's own residual, locked in at whatever it cost when THAT
    // deal was booked — a discount given before you crossed the
    // accelerator doesn't get rewritten once later deals cross it, so
    // this can (and usually does) stay well above zero even once
    // s.accelerated is true. The suffix exists so that isn't read as a
    // contradiction — without it "past your accelerator" right above a
    // nonzero red figure reads as the two disagreeing with each other.
    {
      label: 'Left on the table',
      value: lost > 0 ? fmtMoney(lost) : '—',
      suffix: lost > 0 ? `· across every discount given this ${noun}` : undefined,
      tone: lost > 0 ? 'red' : 'dim',
    },
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
          {demo && (
            <p className="quota-bridge">
              Sample data — every figure above is real math on numbers that aren’t yours yet.{' '}
              <Link className="btn-text" href="/?plan=1">
                Put your plan in &rarr;
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
