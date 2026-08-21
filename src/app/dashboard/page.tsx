import Link from 'next/link';
import { redirect } from 'next/navigation';
import Masthead from '@/components/Masthead';
import Footnote from '@/components/Footnote';
import ProgressBar from '@/components/ProgressBar';
import { getCompPlan, getQuarterToDate, requireUser } from '@/lib/queries';
import { quarterLabel, quarterSummary } from '@/lib/calc';
import { fmt, fmtD } from '@/lib/format';

export const metadata = { title: 'Quota — IOI' };

export default async function DashboardPage() {
  const { user } = await requireUser();
  const plan = await getCompPlan();
  if (!plan) redirect('/setup');

  const { arrBooked, commissionBooked, bonusesBooked, deals } = await getQuarterToDate();
  const s = quarterSummary(plan, { arrBooked, commissionBooked, bonusesBooked });
  const q = quarterLabel();

  const locations = deals.reduce((n, d) => n + d.locations, 0);
  const oneTime = deals.reduce((n, d) => n + d.one_time_revenue, 0);
  const barColor = s.attained ? 'var(--green)' : s.quotaPct >= 70 ? 'var(--accent)' : 'var(--steel)';

  return (
    <div className="app">
      <Masthead email={user.email ?? ''} current="/dashboard" />

      <div className="context">
        <div className="ctx-field">
          <span className="label">Quarter</span>
          <span className="ctx-value">{q}</span>
        </div>
        <div className="ctx-field">
          <span className="label">Plan</span>
          <span className="ctx-value">{plan.role_name}</span>
        </div>
        <div className="rate-block">
          {s.attained ? (
            <>
              <span className="rate-num" style={{ color: 'var(--green)' }}>+{plan.accelerator_pct}%</span>
              <div className="rate-side">
                <span className="rate-state" style={{ color: 'var(--green)' }}>ACCELERATED</span>
                <span className="rate-note">retroactive on the whole quarter</span>
              </div>
            </>
          ) : (
            <>
              <span className="rate-num" style={{ color: 'var(--accent)' }}>{fmt(s.arrToQuota)}</span>
              <div className="rate-side">
                <span className="rate-state" style={{ color: 'var(--accent)' }}>ARR TO QUOTA</span>
                <span className="rate-note">then +{plan.accelerator_pct}% on everything closed</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">{q}, from your saved deals</div>
        <div className="stat-grid">
          <div className="stat">
            <span className="label">Deals closed</span>
            <div className="stat-value">{deals.length}</div>
            <div className="stat-sub">{locations} location{locations !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat">
            <span className="label">New ARR booked</span>
            <div className="stat-value">{fmt(arrBooked)}</div>
            <div className="stat-sub">of {fmt(plan.quarterly_arr_quota)} quota</div>
          </div>
          <div className="stat">
            <span className="label">{s.attained ? 'Quarter payout' : 'Payout at current pace'}</span>
            <div className={`stat-value${s.attained ? ' green' : ''}`}>{fmtD(s.payout)}</div>
            <div className="stat-sub">
              {s.attained
                ? `includes the +${plan.accelerator_pct}% retroactive bump`
                : 'commission + bonuses, before accelerator'}
            </div>
          </div>
          <div className="stat">
            <span className="label">{s.attained ? 'Accelerator earned' : 'Crossing quota is worth'}</span>
            <div className={`stat-value ${s.attained ? 'green' : 'accent'}`}>
              +{fmtD(s.acceleratorValue)}
            </div>
            <div className="stat-sub">
              {s.attained
                ? 'already added to your payout'
                : 'instantly, on deals you have already closed'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Quota position</div>
        <div className="tracker-row">
          <span className="label">Quarterly ARR quota</span>
          <div className="tracker-main">
            {fmt(arrBooked)} / {fmt(plan.quarterly_arr_quota)}
          </div>
          <ProgressBar pct={s.quotaPct} color={barColor} />
          <div className="tracker-sub">
            {s.attained ? (
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                Quota made — every deal for the rest of {q} earns +{plan.accelerator_pct}%.
              </span>
            ) : (
              <>
                {s.quotaPct}% there. {fmt(s.arrToQuota)} in new ARR unlocks +
                {fmtD(s.acceleratorValue)} retroactively.
              </>
            )}
          </div>
        </div>
        <div className="tracker-row">
          <span className="label">Earned this quarter</span>
          <div className="tracker-main">
            {fmtD(s.payout)}
            <span className="muted"> · commission {fmtD(commissionBooked * (s.attained ? 1 + plan.accelerator_pct / 100 : 1))} · bonuses {fmtD(bonusesBooked)}</span>
          </div>
          <div className="tracker-sub">
            One-time onboarding revenue sold: {fmt(oneTime)}. Payouts are quarterly today —
            MarginEdge is shifting to monthly at some point.
          </div>
        </div>
      </div>

      {deals.length === 0 && (
        <div className="card">
          <div className="empty">
            Nothing booked in {q} yet.
            <br />
            <Link href="/deal" style={{ color: 'var(--accent)' }}>Enter a deal</Link> and this
            dashboard fills itself in.
          </div>
        </div>
      )}

      <Footnote />
    </div>
  );
}
