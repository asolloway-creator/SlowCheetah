import Link from 'next/link';
import Masthead from '@/components/Masthead';
import Footnote from '@/components/Footnote';
import { listDeals, requireUser } from '@/lib/queries';
import { COMMISSIONABLE, dealAnnualizedArr } from '@/lib/calc';
import { fmt, fmtD, fmtDate } from '@/lib/format';
import { deleteDeal } from '../deal/actions';

export const metadata = { title: 'Deal history — IOI' };

/** Discounted deal value, the same commissionable figure the builder shows. */
function dealValue(d: {
  one_time_amount: number;
  implementation_amount: number;
  one_time_discount_pct: number;
  implementation_discount_pct: number;
  subscription_amount: number;
  subscription_mode: 'mrr' | 'acv';
  subscription_discount_pct: number;
}) {
  const ot = d.one_time_amount * (1 - d.one_time_discount_pct / 100);
  const impl = d.implementation_amount * (1 - d.implementation_discount_pct / 100);
  return (
    (ot * COMMISSIONABLE.oneTimeWeight) / 100 +
    (impl * COMMISSIONABLE.implWeight) / 100 +
    dealAnnualizedArr(d)
  );
}

/** Blended discount across the deal, weighted by list value. */
function blendedDiscountPct(d: Parameters<typeof dealValue>[0]) {
  const otFull = (d.one_time_amount * COMMISSIONABLE.oneTimeWeight) / 100;
  const implFull = (d.implementation_amount * COMMISSIONABLE.implWeight) / 100;
  const subFull =
    d.subscription_mode === 'acv'
      ? d.subscription_amount
      : d.subscription_amount * COMMISSIONABLE.subMult;
  const full = otFull + implFull + subFull;
  if (full <= 0) return 0;
  const off =
    (otFull * d.one_time_discount_pct) / 100 +
    (implFull * d.implementation_discount_pct) / 100 +
    (subFull * d.subscription_discount_pct) / 100;
  return (off / full) * 100;
}

export default async function HistoryPage() {
  const { user } = await requireUser();
  const deals = await listDeals();

  const totalCommission = deals.reduce((s, d) => s + d.commission_earned, 0);
  const totalLost = deals.reduce((s, d) => s + d.money_left_on_table, 0);

  return (
    <div className="app">
      <Masthead email={user.email ?? ''} current="/history" />

      {deals.length > 0 && (
        <div className="card">
          <div className="card-title">All time</div>
          <div className="stat-grid">
            <div className="stat">
              <span className="label">Deals</span>
              <div className="stat-value">{deals.length}</div>
              <div className="stat-sub">
                {deals.reduce((s, d) => s + d.units, 0)} units booked
              </div>
            </div>
            <div className="stat">
              <span className="label">Commission earned</span>
              <div className="stat-value gold">{fmtD(totalCommission)}</div>
              <div className="stat-sub">across every deal you&rsquo;ve entered</div>
            </div>
            <div className="stat">
              <span className="label">Left on the table</span>
              <div className="stat-value red">{fmtD(totalLost)}</div>
              <div className="stat-sub">what discounting cost you</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Deal history</div>
        {deals.length === 0 ? (
          <div className="empty">
            No deals yet.
            <br />
            <Link href="/deal" style={{ color: 'var(--gold)' }}>
              Enter your first one
            </Link>{' '}
            and it will show up here, and stay here.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="deals">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Units</th>
                  <th>Deal value</th>
                  <th>Discount</th>
                  <th>Commission</th>
                  <th>Left on table</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const disc = blendedDiscountPct(d);
                  return (
                    <tr key={d.id}>
                      <td className="dim">{fmtDate(d.created_at)}</td>
                      <td className="dim">{d.units}</td>
                      <td>{fmt(dealValue(d))}</td>
                      <td className={disc > 0 ? 'red' : 'dim'}>{disc.toFixed(1)}%</td>
                      <td className="gold">{fmtD(d.commission_earned)}</td>
                      <td className={d.money_left_on_table > 0 ? 'red' : 'dim'}>
                        {fmtD(d.money_left_on_table)}
                      </td>
                      <td>
                        <form action={deleteDeal}>
                          <input type="hidden" name="id" value={d.id} />
                          <button className="link-btn" type="submit" aria-label="Delete deal">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Footnote />
    </div>
  );
}
