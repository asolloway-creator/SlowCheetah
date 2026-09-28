import Link from 'next/link';
import { COMPANY_SIZE_BANDS } from '@/lib/calc';
import { fmtMoney, planSentence } from '@/lib/format';
import { RANGES, stepOf, type Account, type Env, type Range, type Traffic } from '@/lib/admin';
import { BarList, DailyChart, Journey, MixCard, StatTile, Tag } from '@/components/admin/AdminParts';

const DAY = 86_400_000;
const SIZE_LABEL = Object.fromEntries(COMPANY_SIZE_BANDS);
const SOURCE_LABEL: Record<string, string> = {
  direct: 'Direct',
  linkedin: 'LinkedIn',
  google: 'Google',
  meta: 'Facebook / Instagram',
  x: 'X',
};

const dayKey = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const keyToUtc = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const dayLabel = (k: string) =>
  new Date(keyToUtc(k)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function when(iso: string | null, tz: string) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz });
}

/** Every day in range, zero-filled, capped at the most recent 60. */
function daySeries(daily: { day: string; visitors: number }[], range: Range, tz: string) {
  const today = dayKey(new Date(), tz);
  const byDay = new Map(daily.map((d) => [d.day, d.visitors]));
  const span = range === '7d' ? 7 : range === '30d' ? 30 : daily.length ? Math.round((keyToUtc(today) - keyToUtc(daily[0].day)) / DAY) + 1 : 1;
  const n = Math.min(60, Math.max(1, span));
  return Array.from({ length: n }, (_, i) => {
    const k = new Date(keyToUtc(today) - (n - 1 - i) * DAY).toISOString().slice(0, 10);
    return { label: dayLabel(k), value: byDay.get(k) ?? 0 };
  });
}

function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}


/** The dashboard, drawn from already-fetched data (app/admin/page.tsx fetches it). */
export default function DashboardView({
  accounts,
  traffic,
  range,
  env,
  showEmails,
  sinceMs,
  weekAgo,
  tz,
}: {
  accounts: Account[];
  traffic: Traffic;
  range: Range;
  env: Env;
  showEmails: boolean;
  sinceMs: number;
  weekAgo: number;
  tz: string;
}) {
  const since = new Date(sinceMs);
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { range: range === '30d' ? undefined : range, emails: showEmails ? '1' : undefined, env: env === 'production' ? undefined : env, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  // Real usage never includes your own account.
  const real = accounts.filter((a) => !a.isAdmin);
  const lastActive = (a: Account) => Math.max(a.lastSignInAt ? Date.parse(a.lastSignInAt) : 0, a.lastDealAt ? Date.parse(a.lastDealAt) : 0);
  const withPlan = real.filter((a) => a.plan);
  const newInRange = real.filter((a) => Date.parse(a.createdAt) >= since.getTime()).length;

  const own = {
    saved: stepOf(traffic, 'plan_saved', 'own').visitors,
    dragged: stepOf(traffic, 'slider_drag', 'own').visitors,
    crossed: stepOf(traffic, 'bonus_line_crossed', 'own').visitors,
    booked: stepOf(traffic, 'deal_booked', 'own').visitors,
  };
  const sampleBooked = stepOf(traffic, 'deal_booked', 'sample');
  const mobile = traffic.devices.find((d) => d.device === 'mobile')?.visitors ?? 0;
  const rangeLabel = RANGES.find(([r]) => r === range)?.[1].toLowerCase() ?? '';

  return (
    <div className="admin">
        <header className="admin-head">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="admin-sub">
              {env !== 'production' && <b>Showing {env} data, not the live site. </b>}
              Excludes your own account, any device where you&rsquo;ve opened this page, previews, local testing and
              automated browsers.
            </p>
          </div>
          <nav className="admin-range" aria-label="Date range">
            {RANGES.map(([r, label]) => (
              <Link key={r} href={`/admin${q({ range: r === '30d' ? undefined : r })}`} aria-current={r === range ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        </header>

        {/* ---------------------------------------------------------------- real usage */}
        <section className="admin-section" aria-labelledby="real-h">
          <div className="admin-section-head">
            <h2 id="real-h" className="admin-h">Real usage</h2>
            <Tag kind="real" />
            <p className="admin-section-note">People working with their own numbers. The sample deal never counts here.</p>
          </div>

          <h3 className="admin-h3">Accounts</h3>
          <div className="stat-row">
            <StatTile label="Accounts" value={real.length} note="all time" />
            <StatTile label="New accounts" value={newInRange} note={rangeLabel} />
            <StatTile label="Saved a plan" value={withPlan.length} note={`of ${real.length}`} />
            <StatTile label="Booked a deal" value={real.filter((a) => a.deals > 0).length} note={`${real.reduce((n, a) => n + a.deals, 0)} deals in total`} />
            <StatTile label="Active in the last 7 days" value={real.filter((a) => lastActive(a) >= weekAgo).length} note="signed in or booked a deal" />
          </div>

          <h3 className="admin-h3">Visitors using their own plan, without an account</h3>
          <p className="admin-caption">
            Saved only in their browser, so you see that it happened, never their numbers. {rangeLabel[0]?.toUpperCase()}
            {rangeLabel.slice(1)}.
          </p>
          <div className="stat-row">
            <StatTile label="Saved their own plan" value={own.saved} note="visitors" />
            <StatTile label="Dragged a discount on it" value={own.dragged} note="visitors" />
            <StatTile label="Crossed a bonus line on it" value={own.crossed} note="visitors" />
            <StatTile label="Booked a deal on it" value={own.booked} note="visitors" />
          </div>

          <div className="admin-h3-row">
            <h3 className="admin-h3">Every account</h3>
            <Link className="btn-text admin-small" href={`/admin${q({ emails: showEmails ? undefined : '1' })}`}>
              {showEmails ? 'Hide emails' : 'Show emails'}
            </Link>
          </div>
          {accounts.length === 0 ? (
            <p className="admin-empty">No accounts yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Joined</th>
                    <th>Last active</th>
                    <th>Plan</th>
                    <th>Industry · size</th>
                    <th className="num">Deals</th>
                    <th className="num">Commission booked</th>
                  </tr>
                </thead>
                <tbody>
                  {[...accounts].reverse().map((a) => (
                    <tr key={a.id} className={a.isAdmin ? 'is-you' : undefined}>
                      <td>
                        <Link href={`/admin/users/${a.id}${q({})}`}>{showEmails ? a.email : `User ${a.number}`}</Link>
                        {a.isAdmin && <span className="admin-you">You, excluded</span>}
                      </td>
                      <td>{when(a.createdAt, tz)}</td>
                      <td>{lastActive(a) ? when(new Date(lastActive(a)).toISOString(), tz) : 'Never'}</td>
                      <td className="admin-plan-cell" title={a.plan ? planSentence(a.plan) : undefined}>
                        {a.plan ? planSentence(a.plan) : <span className="admin-muted">No plan yet</span>}
                      </td>
                      <td>
                        {a.plan?.industry || a.plan?.company_size_band ? (
                          [a.plan.industry, a.plan.company_size_band ? SIZE_LABEL[a.plan.company_size_band] : null].filter(Boolean).join(' · ')
                        ) : (
                          <span className="admin-muted">Not given</span>
                        )}
                      </td>
                      <td className="num">{a.deals}</td>
                      <td className="num">{a.deals ? fmtMoney(a.commission) : <span className="admin-muted">None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="admin-h3">Plan mix</h3>
          {withPlan.length === 0 ? (
            <p className="admin-empty">No saved plans yet. Once people put theirs in, the shapes show up here.</p>
          ) : (
            <div className="mix-grid">
              <MixCard title="Quota measured in" rows={countBy(withPlan, (a) => (a.plan!.quota_basis === 'units' ? 'Units' : 'New ARR'))} />
              <MixCard title="Quota period" rows={countBy(withPlan, (a) => (a.plan!.period === 'quarter' ? 'Quarterly' : 'Monthly'))} />
              <MixCard
                title="Accelerator"
                rows={countBy(withPlan, (a) =>
                  a.plan!.accelerator_style === 'rate_switch' ? 'Rate switch' : a.plan!.accelerator_style === 'retro_bump' ? 'Retroactive bump' : 'None',
                )}
              />
              <MixCard title="Quarterly bonus" rows={countBy(withPlan, (a) => (a.plan!.quarterly_kicker ? 'Has one' : 'None'))} />
              <MixCard title="Industry" rows={countBy(withPlan, (a) => a.plan!.industry?.trim() || 'Not given')} />
              <MixCard
                title="Company size"
                rows={countBy(withPlan, (a) => (a.plan!.company_size_band ? SIZE_LABEL[a.plan!.company_size_band] : 'Not given'))}
              />
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------- traffic + sample */}
        <section className="admin-section is-sample" aria-labelledby="sample-h">
          <div className="admin-section-head">
            <h2 id="sample-h" className="admin-h">Traffic and the sample deal</h2>
            <Tag kind="sample" />
            <p className="admin-section-note">Who&rsquo;s coming and how they play with the demo. None of this counts as real usage.</p>
          </div>

          <div className="stat-row">
            <StatTile label="Visitors" value={traffic.visitors} note={rangeLabel} />
            <StatTile label="Visits" value={traffic.sessions} note="a visitor can come back" />
            <StatTile label="Page views" value={traffic.pageViews} />
            <StatTile label="On a phone" value={`${traffic.visitors ? Math.round((mobile / traffic.visitors) * 100) : 0}%`} note="of visitors" />
          </div>

          <div className="admin-grid-2">
            <div className="admin-card">
              <h3 className="admin-h3">Visitors per day</h3>
              <DailyChart points={daySeries(traffic.daily, range, tz)} unit="visitor" emptyText="No visits in this period yet." />
            </div>
            <div className="admin-card">
              <h3 className="admin-h3">Where visitors came from</h3>
              <BarList
                rows={traffic.sources.map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.visitors }))}
                emptyText="No visits in this period yet."
              />
              <p className="admin-caption">
                Direct means texts, emails and typed-in visits, which don&rsquo;t say where they came from. Add{' '}
                <code>?utm_source=linkedin</code> to a link you share and it&rsquo;s counted under that name instead.
              </p>
            </div>
          </div>

          <div className="admin-card">
            <h3 className="admin-h3">Visitor journey</h3>
            <p className="admin-caption">Share of visitors who reached each step. A visitor counts once per step.</p>
            <Journey
              base={traffic.journey.visited}
              steps={[
                { label: 'Visited the site', value: traffic.journey.visited },
                { label: 'Dragged the sample discount', value: traffic.journey.sampleDrag, tag: 'sample' },
                { label: 'Crossed the bonus line on the sample', value: traffic.journey.sampleCross, tag: 'sample' },
                { label: 'Opened the plan form', value: traffic.journey.formOpened },
                { label: 'Saved their own plan', value: traffic.journey.ownSaved, tag: 'real' },
                { label: 'Asked for a sign-in link', value: traffic.journey.signinStarted, tag: 'real' },
                { label: 'Created an account', value: newInRange, tag: 'real', note: 'from accounts' },
              ]}
            />
            <p className="admin-caption">
              Sample deals booked: {sampleBooked.events} by {sampleBooked.visitors} visitor{sampleBooked.visitors === 1 ? '' : 's'}.
            </p>
          </div>
        </section>

        <p className="admin-foot">
          {traffic.firstEventAt
            ? `Visitor tracking started ${when(traffic.firstEventAt, tz)}. Last activity recorded ${new Date(traffic.lastEventAt ?? traffic.firstEventAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz })}.`
            : 'Visitor tracking is on. Nothing recorded yet: visits start counting from the first one after this went live.'}
        </p>
    </div>
  );
}
