'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LOST_REASONS, periodLabel, quarterlyKickerSummary, type CompPlan, type DealAccount, type PeriodToDate, type QuarterToDate, type Quote } from '@/lib/calc';
import { withCloseDate } from '@/lib/closeout';
import { ageBuckets, coverage, FLAG_WORDS, FLAGS, OLD_DAYS, QUIET_DAYS, unitHealth, winRate, type UnitHealth } from '@/lib/health';
import { nextPeriodStart } from '@/lib/rollover';
import { fmtCredit, fmtMoney, fmtRev, revWord } from '@/lib/format';

/** How many decisions the list shows before "Show all". */
const SHOWN = 5;

const times = (n: number) => `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}×`;

/** "Nov 14" */
function dayName(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Pipeline health, under the close-out: whether what's open can feed the
 * number this period and this quarter, what's going cold and the commission
 * on it, how old the pipeline is, and how often the rep wins what gets
 * decided. Commission visibility stays the point; this keeps it fed.
 */
export default function PipelineHealth({
  plan,
  ptd,
  qtd,
  quotes,
  accounts,
  deals,
  lost,
  calendar,
  onCloseDate,
  openHref,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  quotes: Quote[];
  accounts: DealAccount[];
  deals: { created_at: string; kind?: 'deal' | 'upsell' }[];
  lost: { closedAt: string; reason: string | null }[];
  calendar: { today: string; periodStart: string; quarterDaysLeft: number };
  onCloseDate?: (ids: string[], date: string | null) => Promise<{ error?: string }>;
  /** Where a decision's name links: its quote on the deal desk. */
  openHref?: (quoteId: string) => string;
}) {
  const [dates, setDates] = useState<Record<string, string | null>>({});
  const [all, setAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = nextPeriodStart(plan.period, calendar.periodStart);
  const live = quotes.map((q) => (q.id in dates ? withCloseDate({ ...q, closeDate: dates[q.id] }, next) : q));
  const units = unitHealth(plan, ptd, live, accounts, calendar.today);
  const wins = winRate(deals, lost, calendar.today);
  if (!units.length && wins.won + wins.lost === 0) return null;

  const name = periodLabel(plan.period).split(' ')[0];
  // This period: everything not called or dated into a later one.
  const thisPeriod = units.filter((u) => u.unit.forecast !== 'next');
  const openNow = thisPeriod.reduce((n, u) => n + u.credit, 0);
  const toGo = Math.max(0, plan.quota - ptd.creditBooked);
  const cover = coverage(openNow, toGo);
  // This quarter, for a Quarterly Bonus: everything not dated past it.
  const k = plan.quarterly_kicker && qtd ? quarterlyKickerSummary(plan, qtd) : null;
  const [ty, tm] = calendar.today.split('-').map(Number);
  const quarterEnd = new Date(Date.UTC(ty, Math.floor((tm - 1) / 3) * 3 + 3, 1)).toISOString().slice(0, 10);
  const openQuarter = units.filter((u) => !u.unit.closeDate || u.unit.closeDate < quarterEnd).reduce((n, u) => n + u.arr, 0);
  const coverQ = k && k.nextTier ? coverage(openQuarter, k.toNextTierArr) : null;

  // Worst first (the flag order is the severity order), then the most money.
  const rank = (u: UnitHealth) => FLAGS.indexOf(u.flags[0]);
  const cold = units.filter((u) => u.flags.length > 0).sort((a, b) => rank(a) - rank(b) || b.pay - a.pay);
  const coldPay = cold.reduce((n, u) => n + u.pay, 0);
  const buckets = ageBuckets(units);
  const totalCredit = buckets.reduce((n, b) => n + b.credit, 0);
  const reason = wins.topReason ? LOST_REASONS.find((r) => r.key === wins.topReason)?.label.toLowerCase() : null;

  async function closeOn(u: UnitHealth, date: string | null) {
    const ids = u.unit.quotes.map((q) => q.id);
    setDates((c) => ({ ...c, ...Object.fromEntries(ids.map((id) => [id, date])) }));
    setError(null);
    if (!onCloseDate) return;
    let res: { error?: string };
    try {
      res = await onCloseDate(ids, date);
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    if (res.error) setError(res.error);
  }

  const shown = all ? cold : cold.slice(0, SHOWN);

  return (
    <section className="ph" aria-labelledby="ph-h">
      <header className="ph-head">
        <h2 id="ph-h" className="cd-h">
          Pipeline health
        </h2>
        <p className="co-sub">
          {units.length} open {units.length === 1 ? 'decision' : 'decisions'} · what keeps your commission coming after this {plan.period}
        </p>
      </header>

      <div className="ph-tiles">
        <div className="ph-tile">
          <p className="ph-k">Coverage, {name}</p>
          {cover === null ? (
            <>
              <p className="ph-v is-green">Quota reached</p>
              <p className="ph-n">{fmtCredit(plan, openNow)} still open this {plan.period}, all of it paying past quota.</p>
            </>
          ) : (
            <>
              <p className={`ph-v${cover >= 3 ? ' is-green' : cover < 1 ? ' is-red' : ''}`}>{times(cover)}</p>
              <p className="ph-n">
                {fmtCredit(plan, openNow)} open for {fmtCredit(plan, toGo)} to go.{' '}
                {cover < 1 ? 'Even if all of it closes, you come up short.' : 'A common rule of thumb is 3×, since not all of it will close.'}
              </p>
            </>
          )}
        </div>

        {k && (
          <div className="ph-tile">
            <p className="ph-k">Coverage, Quarterly Bonus</p>
            {coverQ === null ? (
              <>
                <p className="ph-v is-green">{k.tier ? 'Locked in' : 'Reached'}</p>
                <p className="ph-n">
                  {fmtRev(plan, openQuarter)} new {revWord(plan)} still open this quarter.
                </p>
              </>
            ) : (
              <>
                <p className={`ph-v${coverQ >= 3 ? ' is-green' : coverQ < 1 ? ' is-red' : ''}`}>{times(coverQ)}</p>
                <p className="ph-n">
                  {fmtRev(plan, openQuarter)} new {revWord(plan)} open for {fmtRev(plan, k.toNextTierArr)} to go, {calendar.quarterDaysLeft}{' '}
                  {calendar.quarterDaysLeft === 1 ? 'day' : 'days'} left.
                </p>
              </>
            )}
          </div>
        )}

        <div className="ph-tile">
          <p className="ph-k">Going cold</p>
          <p className={`ph-v${cold.length ? ' is-red' : ' is-green'}`}>{cold.length ? `${cold.length} of ${units.length}` : 'None'}</p>
          <p className="ph-n">
            {cold.length
              ? `${fmtMoney(coldPay)} in commission sits on ${cold.length === 1 ? 'it' : 'them'}.`
              : 'Every open decision has a date ahead of it and a recent touch.'}
          </p>
        </div>

        <div className="ph-tile">
          <p className="ph-k">Win rate, last 90 days</p>
          {wins.rate === null ? (
            <>
              <p className="ph-v is-muted">Too early</p>
              <p className="ph-n">It shows once three deals are decided: won, or marked lost.</p>
            </>
          ) : (
            <>
              <p className="ph-v">{Math.round(wins.rate * 100)}%</p>
              <p className="ph-n">
                {wins.won} won, {wins.lost} lost{reason ? ` · lost most often on ${reason}` : ''}.
              </p>
            </>
          )}
        </div>
      </div>

      {units.length > 0 && (
        <div className="ph-age">
          <p className="ph-k">How old the pipeline is, by what it&rsquo;s worth</p>
          <div className="ph-age-track" role="img" aria-label={buckets.map((b) => `${b.label}: ${b.count}, ${fmtCredit(plan, b.credit)}`).join('; ')}>
            {buckets.map((b, i) =>
              b.credit > 0 ? <span key={b.label} className={`ph-seg is-${i}`} style={{ width: `${(b.credit / (totalCredit || 1)) * 100}%` }} /> : null,
            )}
          </div>
          <ol className="ph-buckets">
            {buckets.map((b, i) => (
              <li key={b.label} className={`ph-bucket is-${i}${b.count ? '' : ' is-empty'}`}>
                <span className="ph-b-label">
                  <span className="ph-dot" aria-hidden="true" />
                  {b.label}
                </span>
                <span className="ph-b-credit">{b.count ? fmtCredit(plan, b.credit) : 'None'}</span>
                <span className="ph-b-count">{b.count ? `${b.count} ${b.count === 1 ? 'decision' : 'decisions'}` : ''}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {cold.length > 0 && (
        <>
          <h3 className="ph-list-h">Needs a look</h3>
          <ul className="ph-list">
            {shown.map((u) => (
              <li key={u.unit.key} className="ph-row">
                <div className="co-row-main">
                  <p className="co-row-name">
                    {openHref ? (
                      <Link href={openHref(u.unit.quotes[0].id)} className="as-deal-link">
                        {u.unit.label || 'Unnamed quote'}
                      </Link>
                    ) : (
                      u.unit.label || 'Unnamed quote'
                    )}
                    {u.flags.map((f) => (
                      <span key={f} className={`ph-flag is-${f}`}>
                        {FLAG_WORDS[f]}
                      </span>
                    ))}
                  </p>
                  <p className="co-row-meta">
                    {fmtCredit(plan, u.credit)} · adds about {fmtMoney(u.pay)} · open {u.age} {u.age === 1 ? 'day' : 'days'}
                    {u.idle >= QUIET_DAYS && ` · last touched ${u.idle} days ago`}
                    {u.unit.closeDate && ` · expected ${dayName(u.unit.closeDate)}`}
                    {u.unit.pushes > 0 && ` · pushed ${u.unit.pushes === 1 ? 'once' : u.unit.pushes === 2 ? 'twice' : `${u.unit.pushes} times`}`}
                  </p>
                  <p className="ph-why">{nextMove(u)}</p>
                </div>
                {onCloseDate && (
                  <label className={`co-date${u.flags.includes('past-date') ? ' is-past' : ''}`}>
                    <span>Closes</span>
                    <input
                      type="date"
                      value={u.unit.closeDate ?? ''}
                      aria-label={`Expected close date for ${u.unit.label || 'this quote'}`}
                      onChange={(e) => void closeOn(u, e.target.value || null)}
                    />
                  </label>
                )}
              </li>
            ))}
          </ul>
          {cold.length > SHOWN && (
            <button type="button" className="btn-text ph-more" onClick={() => setAll((a) => !a)}>
              {all ? 'Show fewer' : `Show all ${cold.length}`}
            </button>
          )}
        </>
      )}
      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** One line on what to do about it, for the first thing wrong. */
function nextMove(u: UnitHealth): string {
  const f = u.flags[0];
  if (f === 'past-date') return 'The date it was meant to close has gone by. Confirm a new one with them, or mark it lost.';
  if (f === 'pushed') return 'It keeps sliding. Ask what has to happen before they sign, and who decides.';
  if (f === 'quiet') return 'Nothing has moved in weeks. A short call with a reason to talk now does more than another follow-up.';
  if (f === 'no-date') return 'No close date yet. Ask when they want to be live, and work back from it.';
  if (f === 'aging') return `Open over ${OLD_DAYS} days. If it isn't moving, marking it lost keeps your forecast honest.`;
  return '';
}
