import Link from 'next/link';
import Masthead from '@/components/Masthead';
import Footnote from '@/components/Footnote';
import { listDeals, requireUser } from '@/lib/queries';
import { PACKAGE_LABELS } from '@/lib/calc';
import { fmt, fmtD, fmtDate } from '@/lib/format';
import { deleteDeal } from '../deal/actions';

export const metadata = { title: 'Deal history — IOI' };

const quarterOf = (iso: string) => {
  const d = new Date(iso);
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
};

export default async function HistoryPage() {
  const { user } = await requireUser();
  const deals = await listDeals();

  const totalCommission = deals.reduce((s, d) => s + d.commission_base, 0);
  const totalBonuses = deals.reduce((s, d) => s + d.bonus_amount, 0);
  const totalArr = deals.reduce((s, d) => s + d.arr, 0);

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
                {deals.reduce((s, d) => s + d.locations, 0)} locations
              </div>
            </div>
            <div className="stat">
              <span className="label">ARR sold</span>
              <div className="stat-value">{fmt(totalArr)}</div>
              <div className="stat-sub">annualized, after discount</div>
            </div>
            <div className="stat">
              <span className="label">Commission + bonuses</span>
              <div className="stat-value accent">{fmtD(totalCommission + totalBonuses)}</div>
              <div className="stat-sub">base — accelerator bumps land per quarter</div>
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
            <Link href="/deal" style={{ color: 'var(--accent)' }}>Enter your first one</Link>{' '}
            and it will show up here, and stay here.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="deals">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Qtr</th>
                  <th>Locs</th>
                  <th>Package</th>
                  <th>MRR</th>
                  <th>ARR</th>
                  <th>Disc</th>
                  <th>Commission</th>
                  <th>Bonus</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id}>
                    <td className="dim">{fmtDate(d.created_at)}</td>
                    <td className="dim">{quarterOf(d.created_at)}</td>
                    <td>{d.locations}{d.freepour ? ' ⚖' : ''}</td>
                    <td className="dim">{PACKAGE_LABELS[d.onboarding_package]}</td>
                    <td>{fmt(d.mrr)}</td>
                    <td>{fmt(d.arr)}</td>
                    <td className={d.saas_discount_pct > 0 ? 'red' : 'dim'}>
                      {d.saas_discount_pct > 0 ? `${d.saas_discount_pct}%` : '—'}
                    </td>
                    <td className="accent">{fmtD(d.commission_base)}</td>
                    <td className="dim">+{fmt(d.bonus_amount)}</td>
                    <td>
                      <form action={deleteDeal}>
                        <input type="hidden" name="id" value={d.id} />
                        <button className="link-btn" type="submit" aria-label="Delete deal">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-note" style={{ marginTop: 10 }}>
              ⚖ = Freepour attached. Commission shown pre-accelerator; the quarterly bump is
              applied on the Quota page.
            </div>
          </div>
        )}
      </div>

      <Footnote />
    </div>
  );
}
