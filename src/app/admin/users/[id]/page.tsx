import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell } from '@/app/AccountViews';
import { COMPANY_SIZE_BANDS, isFixedTier } from '@/lib/calc';
import { fmtCredit, fmtMoney, fmtPctShort, fmtRateShort, periodNoun, planSentence } from '@/lib/format';
import { listDeals } from '@/lib/queries';
import { adminTimeZone, getAccounts, requireAdmin } from '@/lib/admin';

export const metadata = { title: 'User · Dashboard · IOI', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIZE_LABEL = Object.fromEntries(COMPANY_SIZE_BANDS);

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emails?: string; range?: string; env?: string }>;
}) {
  const { supabase, user } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();

  const account = (await getAccounts(supabase)).find((a) => a.id === id);
  if (!account) notFound();
  const deals = await listDeals(id);
  const tz = await adminTimeZone();
  const day = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz }) : 'Never';

  const back = new URLSearchParams();
  if (sp.emails === '1') back.set('emails', '1');
  if (sp.range) back.set('range', sp.range);
  if (sp.env) back.set('env', sp.env);
  const backHref = `/admin${back.toString() ? `?${back}` : ''}`;
  const p = account.plan;

  return (
    <Shell current="/admin" email={user.email ?? ''} width="wide">
      <div className="admin">
        <p className="admin-back">
          <Link className="btn-text" href={backHref}>
            &larr; Dashboard
          </Link>
        </p>
        <h1 className="page-title">{sp.emails === '1' ? account.email : `User ${account.number}`}</h1>
        <p className="admin-sub">
          Joined {day(account.createdAt)} · last signed in {day(account.lastSignInAt)}
          {account.isAdmin && ' · this is you, excluded from every count'}
        </p>

        <section className="admin-card">
          <h2 className="admin-h3">Their plan</h2>
          {p ? (
            <>
              <p className="admin-plan-sentence">
                {p.role_name || 'Rep'}, {fmtCredit(p, p.quota)} {periodNoun(p)}ly quota. {planSentence(p)}.
              </p>
              <dl className="admin-facts">
                <div>
                  <dt>Quota</dt>
                  <dd>
                    {fmtCredit(p, p.quota)} per {periodNoun(p)}
                  </dd>
                </div>
                <div>
                  <dt>Base rate</dt>
                  <dd>{fmtRateShort(p, p.base_rate)}</dd>
                </div>
                <div>
                  <dt>Accelerator</dt>
                  <dd>
                    {p.accelerator_style === 'none'
                      ? 'None'
                      : [{ threshold: p.accelerator_threshold, rate: p.accelerator_rate }, ...(p.accelerator_steps ?? [])]
                          .map((st) => `${p.accelerator_style === 'retro_bump' ? `+${fmtPctShort(st.rate)} retroactive` : fmtRateShort(p, st.rate)} at ${fmtCredit(p, st.threshold)}`)
                          .join(', ')}
                  </dd>
                </div>
                <div>
                  <dt>Quarterly bonus</dt>
                  <dd>
                    {p.quarterly_kicker
                      ? p.quarterly_kicker.tiers
                          .map((t) => `${isFixedTier(t) ? fmtMoney(t.amount as number) : `+${fmtPctShort(t.kickerPct)}`} at ${fmtPctShort(t.attainmentPct)}`)
                          .join(', ') +
                        ` of ${fmtMoney(p.quarterly_kicker.target)}`
                      : 'None'}
                  </dd>
                </div>
                <div>
                  <dt>Industry</dt>
                  <dd>{p.industry || 'Not given'}</dd>
                </div>
                <div>
                  <dt>Company size</dt>
                  <dd>{p.company_size_band ? SIZE_LABEL[p.company_size_band] : 'Not given'}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="admin-empty">No plan saved yet.</p>
          )}
        </section>

        <section className="admin-card">
          <h2 className="admin-h3">
            Deals booked <span className="admin-muted">· {deals.length}</span>
          </h2>
          {deals.length === 0 ? (
            <p className="admin-empty">No deals booked yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Units</th>
                    <th className="num">New ARR</th>
                    <th className="num">One-time</th>
                    <th className="num">Discount</th>
                    <th className="num">Commission</th>
                    <th className="num">Left on the table</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id}>
                      <td>{day(d.created_at)}</td>
                      <td className="num">{d.units}</td>
                      <td className="num">{fmtMoney(d.arr)}</td>
                      <td className="num">{fmtMoney(d.one_time_amount ?? 0)}</td>
                      <td className="num">
                        {[d.subscription_discount_pct ? `${fmtPctShort(d.subscription_discount_pct)} sub` : null, d.one_time_discount_pct ? `${fmtPctShort(d.one_time_discount_pct)} one-time` : null]
                          .filter(Boolean)
                          .join(' · ') || 'None'}
                      </td>
                      <td className="num">{fmtMoney(d.commission_earned)}</td>
                      <td className="num">{d.money_left_on_table > 0 ? <span className="is-red">{fmtMoney(d.money_left_on_table)}</span> : fmtMoney(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
