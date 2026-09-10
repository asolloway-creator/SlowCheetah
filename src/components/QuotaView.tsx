'use client';

import Link from 'next/link';
import { periodLabel, periodSummary, type CompPlan, type PeriodToDate } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmt, fmtD, fmtCredit, fmtRate, periodNoun } from '@/lib/format';
import ProgressBar from '@/components/ProgressBar';

export default function QuotaView({ plan, ptd, deals }: { plan: CompPlan; ptd: PeriodToDate; deals: DealRow[] }) {
  const s = periodSummary(plan, ptd);
  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const retro = plan.accelerator_style === 'retro_bump';
  const hasAccel = plan.accelerator_style !== 'none';
  const accelWord = retro ? `+${plan.accelerator_rate}%` : fmtRate(plan, plan.accelerator_rate);

  const units = deals.reduce((n, d) => n + d.units, 0);
  const arr = deals.reduce((n, d) => n + d.arr, 0);
  const lost = deals.reduce((n, d) => n + d.money_left_on_table, 0);
  const barColor = s.accelerated ? 'var(--green)' : s.quotaPct >= 70 ? 'var(--amber)' : 'var(--steel)';

  // Attach product: what the unattached units are leaving behind.
  const attachUnits = deals.filter((d) => d.attach).reduce((n, d) => n + d.units, 0);
  const nonAttach = units - attachUnits;
  const attachPct = units > 0 ? Math.round((attachUnits / units) * 100) : 0;
  const missedArr = nonAttach * plan.attach_mrr * 12;
  const missedCommission =
    plan.commission_style === 'months_of_mrr' ? nonAttach * plan.attach_mrr * plan.base_rate : missedArr * (plan.base_rate / 100);
  const missedCredit = plan.quota_basis === 'arr' ? missedArr : 0;
  const wouldBe = ptd.creditBooked + missedCredit;
  const wouldCross = hasAccel && !s.accelerated && wouldBe >= plan.accelerator_threshold;

  return (
    <>
      <div className="context">
        <div className="ctx-field"><span className="label">{plan.period === 'quarter' ? 'Quarter' : 'Month'}</span><span className="ctx-value">{label}</span></div>
        <div className="ctx-field"><span className="label">Plan</span><span className="ctx-value">{plan.role_name}</span></div>
        <div className="rate-block">
          {hasAccel && s.accelerated ? (
            <><span className="rate-num" style={{ color: 'var(--green)' }}>{accelWord}</span>
              <div className="rate-side"><span className="rate-state" style={{ color: 'var(--green)' }}>ACCELERATED</span>
                <span className="rate-note">{retro ? `retroactive on the whole ${noun}` : `base was ${fmtRate(plan, plan.base_rate)}`}</span></div></>
          ) : (
            <><span className="rate-num" style={{ color: 'var(--amber)' }}>{hasAccel ? fmtCredit(plan, s.toAccelerator) : fmtRate(plan, plan.base_rate)}</span>
              <div className="rate-side"><span className="rate-state" style={{ color: 'var(--amber)' }}>{hasAccel ? 'TO ACCELERATOR' : 'FLAT RATE'}</span>
                <span className="rate-note">{hasAccel ? (retro ? `then ${accelWord} on everything closed` : `then every deal earns ${accelWord}`) : 'no accelerator on this plan'}</span></div></>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">{label}, from your booked deals</div>
        <div className="stat-grid">
          <div className="stat"><span className="label">Deals</span><div className="stat-value">{deals.length}</div><div className="stat-sub">{units} unit{units !== 1 ? 's' : ''}</div></div>
          <div className="stat"><span className="label">New ARR</span><div className="stat-value">{fmt(arr)}</div><div className="stat-sub">annualized, after discount</div></div>
          <div className="stat"><span className="label">{s.accelerated && retro ? `${noun} payout` : 'Payout at current pace'}</span>
            <div className={`stat-value${s.accelerated ? ' green' : ''}`}>{fmtD(s.payout)}</div>
            <div className="stat-sub">{s.accelerated && retro ? `includes the ${accelWord} retroactive bump` : 'commission as earned'}</div></div>
          <div className="stat"><span className="label">Left on the table</span>
            <div className={`stat-value${lost > 0 ? ' red' : ' green'}`}>{fmtD(lost)}</div>
            <div className="stat-sub">{lost > 0 ? 'given away in discounts' : 'holding the line'}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Quota position</div>
        <div className="tracker-row">
          <span className="label">{plan.period === 'quarter' ? 'Quarterly' : 'Monthly'} quota</span>
          <div className="tracker-main">{fmtCredit(plan, ptd.creditBooked)} / {fmtCredit(plan, plan.quota)}</div>
          <ProgressBar pct={s.quotaPct} color={barColor} />
          <div className="tracker-sub">
            {s.attained ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Quota made.</span> : <>{s.quotaPct}% there — {fmtCredit(plan, s.toQuota)} to go.</>}{' '}
            {hasAccel && !s.accelerated && (retro
              ? <span style={{ color: 'var(--amber)' }}>{fmtCredit(plan, s.toAccelerator)} more unlocks +{fmtD(s.acceleratorValue)} retroactively.</span>
              : <span style={{ color: 'var(--amber)' }}>{fmtCredit(plan, s.toAccelerator)} more and every deal earns {accelWord}.</span>)}
            {hasAccel && s.accelerated && <span style={{ color: 'var(--green)', fontWeight: 600 }}>Accelerator active at {accelWord}.</span>}
          </div>
        </div>
      </div>

      {plan.attach_enabled && deals.length > 0 && (
        <div className="card">
          <div className="card-title">{plan.attach_name || 'Attach'} rate</div>
          <div className="stat-grid">
            <div className="stat"><span className="label">Attach rate</span><div className={`stat-value${attachPct >= 50 ? ' green' : ''}`}>{attachPct}%</div><div className="stat-sub">{attachUnits} of {units} units this {noun}</div></div>
            <div className="stat"><span className="label">Units without it</span><div className="stat-value">{nonAttach}</div><div className="stat-sub">each one is {fmt(plan.attach_mrr * 12)} ARR not taken</div></div>
            <div className="stat"><span className="label">Left unattached</span><div className={`stat-value${nonAttach > 0 ? ' red' : ' green'}`}>{fmt(missedArr)}</div><div className="stat-sub">ARR, plus {fmtD(missedCommission)} commission not earned</div></div>
          </div>
          {nonAttach > 0 && (
            <div className="tracker-sub" style={{ marginTop: 12 }}>
              {wouldCross ? (
                <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                  With {plan.attach_name || 'the attach'} on every unit you&rsquo;ve sold, this {noun} would sit at {fmtCredit(plan, wouldBe)} — past your accelerator
                  {retro ? `, with +${fmtD((plan.accelerator_rate / 100) * (ptd.commissionBooked + missedCommission))} unlocked retroactively` : ''}.
                </span>
              ) : plan.quota_basis === 'arr' ? (
                <>With {plan.attach_name || 'the attach'} on every unit you&rsquo;ve sold, this {noun} would sit at {fmt(wouldBe)} of {fmt(plan.quota)}.</>
              ) : (
                <>That&rsquo;s {fmtD(missedCommission)} of commission this {noun} from one toggle.</>
              )}
            </div>
          )}
        </div>
      )}

      {deals.length === 0 && (
        <div className="card"><div className="empty">Nothing booked in {label} yet.<br /><Link href="/" style={{ color: 'var(--green)' }}>Enter a deal</Link> and this fills itself in.</div></div>
      )}
    </>
  );
}
