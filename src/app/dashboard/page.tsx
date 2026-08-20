import Link from 'next/link';
import { redirect } from 'next/navigation';
import Masthead from '@/components/Masthead';
import Footnote from '@/components/Footnote';
import ProgressBar from '@/components/ProgressBar';
import { getCompPlan, getMonthToDate, requireUser, startOfThisMonth } from '@/lib/queries';
import { fmt, fmtD, fmtP } from '@/lib/format';

export const metadata = { title: 'Quota — IOI' };

export default async function DashboardPage() {
  const { user } = await requireUser();
  const plan = await getCompPlan();
  if (!plan) redirect('/setup');

  const { unitsBooked, arrBooked, deals } = await getMonthToDate();

  const monthLabel = startOfThisMonth().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const isAccelerated = unitsBooked >= plan.accelerator_threshold;
  const rate = isAccelerated ? plan.accelerator_rate : plan.base_rate;
  const unitsToAccelerator = Math.max(0, plan.accelerator_threshold - unitsBooked);
  const unitsToQuota = Math.max(0, plan.monthly_unit_quota - unitsBooked);
  const unitPct = Math.min(100, Math.round((unitsBooked / plan.monthly_unit_quota) * 100));
  const arrPct =
    plan.monthly_arr_quota && plan.monthly_arr_quota > 0
      ? Math.min(100, Math.round((arrBooked / plan.monthly_arr_quota) * 100))
      : null;

  const commissionMtd = deals.reduce((s, d) => s + d.commission_earned, 0);
  const lostMtd = deals.reduce((s, d) => s + d.money_left_on_table, 0);

  const unitBarColor = isAccelerated
    ? 'var(--green)'
    : unitPct >= 70
      ? 'var(--gold)'
      : 'var(--border-strong)';
  const arrBarColor =
    arrPct !== null && arrPct >= 100
      ? 'var(--green)'
      : arrPct !== null && arrPct >= 70
        ? 'var(--gold)'
        : 'var(--border-strong)';

  return (
    <div className="app">
      <Masthead email={user.email ?? ''} current="/dashboard" />

      <div className="context">
        <div className="ctx-field">
          <span className="label">Month</span>
          <span className="ctx-value">{monthLabel}</span>
        </div>
        <div className="ctx-field">
          <span className="label">Plan</span>
          <span className="ctx-value">{plan.role_name}</span>
        </div>
        <div className="rate-block">
          <span
            className="rate-num"
            style={{ color: isAccelerated ? 'var(--green)' : 'var(--gold)' }}
          >
            {fmtP(rate)}
          </span>
          <div className="rate-side">
            <span
              className="rate-state"
              style={{ color: isAccelerated ? 'var(--green)' : 'var(--gold)' }}
            >
              {isAccelerated ? 'ACCELERATED' : 'BASE RATE'}
            </span>
            <span className="rate-note">
              {isAccelerated
                ? `base was ${fmtP(plan.base_rate)}`
                : `accelerates at ${plan.accelerator_threshold} units (${fmtP(plan.accelerator_rate)})`}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">This month, from your saved deals</div>
        <div className="stat-grid">
          <div className="stat">
            <span className="label">Deals booked</span>
            <div className="stat-value">{deals.length}</div>
            <div className="stat-sub">{unitsBooked} units</div>
          </div>
          <div className="stat">
            <span className="label">Commission earned</span>
            <div className="stat-value gold">{fmtD(commissionMtd)}</div>
            <div className="stat-sub">month to date</div>
          </div>
          <div className="stat">
            <span className="label">New ARR booked</span>
            <div className="stat-value">{fmt(arrBooked)}</div>
            <div className="stat-sub">annualized, after discount</div>
          </div>
          <div className="stat">
            <span className="label">Left on the table</span>
            <div className={`stat-value${lostMtd > 0 ? ' red' : ' green'}`}>
              {fmtD(lostMtd)}
            </div>
            <div className="stat-sub">
              {lostMtd > 0 ? 'given away in discounts' : 'holding the line'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Quota position</div>
        <div className="tracker-row">
          <span className="label">Monthly unit quota</span>
          <div className="tracker-main">
            {unitsBooked} / {plan.monthly_unit_quota} units
          </div>
          <ProgressBar pct={unitPct} color={unitBarColor} />
          <div className="tracker-sub">
            {unitsToQuota === 0 ? (
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>Quota made.</span>
            ) : (
              <>
                {unitsToQuota} unit{unitsToQuota !== 1 ? 's' : ''} to quota.
              </>
            )}{' '}
            {isAccelerated ? (
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                Accelerator active at {fmtP(plan.accelerator_rate)}.
              </span>
            ) : (
              <span style={{ color: 'var(--gold)' }}>
                {unitsToAccelerator} unit{unitsToAccelerator !== 1 ? 's' : ''} to unlock{' '}
                {fmtP(plan.accelerator_rate)}.
              </span>
            )}
          </div>
        </div>

        <div className="tracker-row">
          <span className="label">New ARR pace</span>
          <div className="tracker-main">
            {fmt(arrBooked)}
            {plan.monthly_arr_quota ? ` / ${fmt(plan.monthly_arr_quota)}` : ''}
          </div>
          {arrPct !== null && <ProgressBar pct={arrPct} color={arrBarColor} />}
          <div className="tracker-sub">
            {arrPct !== null
              ? `${arrPct}% of this month's ARR target.`
              : 'Add a monthly ARR quota on your comp plan to pace against a target.'}
          </div>
        </div>
      </div>

      {deals.length === 0 && (
        <div className="card">
          <div className="empty">
            Nothing booked this month yet.
            <br />
            <Link href="/deal" style={{ color: 'var(--gold)' }}>
              Enter a deal
            </Link>{' '}
            and this dashboard fills itself in.
          </div>
        </div>
      )}

      <Footnote />
    </div>
  );
}
