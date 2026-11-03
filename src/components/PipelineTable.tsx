'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LOST_REASONS, periodLabel, type CompPlan, type DealAccount, type Forecast, type LostReason, type PeriodToDate, type Quote } from '@/lib/calc';
import { withCloseDate } from '@/lib/closeout';
import { FLAG_WORDS, FLAGS, unitHealth, type UnitHealth } from '@/lib/health';
import { nextPeriodStart } from '@/lib/rollover';
import { fmtCredit, fmtMoney } from '@/lib/format';

type Key = 'name' | 'size' | 'pay' | 'call' | 'closes' | 'age' | 'idle' | 'attention';

const CALLS: { key: Forecast; label: string }[] = [
  { key: 'commit', label: 'Commit' },
  { key: 'stretch', label: 'Stretch' },
  { key: 'next', label: 'Next' },
];
const CALL_ORDER: Record<string, number> = { commit: 0, stretch: 1, next: 2 };

/**
 * Every open decision in one table, sortable, with the call, the close date
 * and Lost editable in the row. The table is where the rep manages the
 * pipe: what's open, what it pays, where each one stands and how long it has
 * been that way. Defaults to what needs a look first.
 */
export default function PipelineTable({
  plan,
  ptd,
  quotes,
  accounts,
  calendar,
  onForecast,
  onCloseDate,
  onLose,
  openHref,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  quotes: Quote[];
  accounts: DealAccount[];
  calendar: { today: string; periodStart: string };
  onForecast?: (ids: string[], forecast: Forecast | null) => Promise<{ error?: string }>;
  onCloseDate?: (ids: string[], date: string | null) => Promise<{ error?: string }>;
  onLose?: (ids: string[], reason: LostReason | null) => Promise<{ error?: string }>;
  openHref: (quoteId: string) => string;
}) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'attention', dir: 1 });
  const [calls, setCalls] = useState<Record<string, Forecast | null>>({});
  const [dates, setDates] = useState<Record<string, string | null>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const next = nextPeriodStart(plan.period, calendar.periodStart);
  const live = quotes
    .filter((q) => !gone.has(q.id))
    .map((q) => {
      let x: Quote = q.id in calls ? { ...q, call: calls[q.id] } : q;
      if (q.id in dates) x = { ...x, closeDate: dates[q.id] };
      return withCloseDate(x, next);
    });
  const rows = unitHealth(plan, ptd, live, accounts, calendar.today);
  if (!rows.length) return null;

  const val = (r: UnitHealth, k: Key): number | string => {
    switch (k) {
      case 'name':
        return (r.unit.label || 'Unnamed quote').toLowerCase();
      case 'size':
        return r.credit;
      case 'pay':
        return r.pay;
      case 'call':
        return r.unit.forecast ? CALL_ORDER[r.unit.forecast] : 3;
      // No date sorts after every date, either way round.
      case 'closes':
        return r.unit.closeDate ?? '9999-12-31';
      case 'age':
        return r.age;
      case 'idle':
        return r.idle;
      case 'attention':
        return r.flags.length ? FLAGS.indexOf(r.flags[0]) : 99;
    }
  };
  const sorted = [...rows].sort((a, b) => {
    const x = val(a, sort.key);
    const y = val(b, sort.key);
    const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : (x as number) - (y as number);
    // Ties: the bigger commission first, so the money leads.
    return c * sort.dir || b.pay - a.pay;
  });

  function by(key: Key) {
    // Numbers read biggest first, words and dates soonest or A first.
    const first: 1 | -1 = key === 'size' || key === 'pay' || key === 'age' || key === 'idle' ? -1 : 1;
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: first }));
  }
  const ariaSort = (k: Key) => (sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');

  async function run(go: () => Promise<{ error?: string }>) {
    setError(null);
    let res: { error?: string };
    try {
      res = await go();
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    if (res.error) setError(res.error);
  }
  const ids = (r: UnitHealth) => r.unit.quotes.map((q) => q.id);

  function call(r: UnitHealth, f: Forecast) {
    const v = r.unit.forecast === f ? null : f;
    setCalls((c) => ({ ...c, ...Object.fromEntries(ids(r).map((id) => [id, v])) }));
    // Called in for this period: a date that kept it out goes, as it does on the server.
    if ((v === 'commit' || v === 'stretch') && r.unit.closeDate && r.unit.closeDate >= next) {
      setDates((c) => ({ ...c, ...Object.fromEntries(ids(r).map((id) => [id, null])) }));
    }
    if (onForecast) void run(() => onForecast(ids(r), v));
  }
  function closeOn(r: UnitHealth, date: string | null) {
    setDates((c) => ({ ...c, ...Object.fromEntries(ids(r).map((id) => [id, date])) }));
    if (onCloseDate) void run(() => onCloseDate(ids(r), date));
  }
  function lose(r: UnitHealth, reason: string) {
    if (!onLose) return;
    const why = reason === 'skip' ? null : (reason as LostReason);
    setGone((g) => new Set([...g, ...ids(r)]));
    void run(() => onLose(ids(r), why));
  }

  const th = (k: Key, label: string, right = false) => (
    <th scope="col" aria-sort={ariaSort(k)} className={right ? 'pt-r' : undefined}>
      <button type="button" className={`pt-sort${sort.key === k ? ' is-on' : ''}`} onClick={() => by(k)}>
        {label}
        <span aria-hidden="true">{sort.key === k ? (sort.dir === 1 ? '↑' : '↓') : ''}</span>
      </button>
    </th>
  );

  return (
    <section className="pt" aria-labelledby="pt-h">
      <header className="pt-head">
        <h2 id="pt-h" className="cd-h">
          Open pipeline
          <span className="app-count">{rows.length}</span>
        </h2>
        <p className="co-sub">Sorted by what needs a look first. Click a heading to sort. Calls and dates save as you set them.</p>
      </header>
      <div className="cd-scroll">
        <table className="pt-table">
          <caption className="sr-only">Open decisions in {periodLabel(plan.period)}, with call, close date and age</caption>
          <thead>
            <tr>
              {th('name', 'Deal')}
              {th('size', 'Size', true)}
              {th('pay', 'Pays', true)}
              {th('call', 'Your call')}
              {th('closes', 'Closes')}
              {th('age', 'Open', true)}
              {th('idle', 'Last touch', true)}
              <th scope="col">Flags</th>
              {onLose && (
                <th scope="col">
                  <span className="sr-only">Mark lost</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const past = r.flags.includes('past-date');
              return (
                <tr key={r.unit.key}>
                  <th scope="row" className="pt-name">
                    <Link href={openHref(r.unit.quotes[0].id)} className="as-deal-link">
                      {r.unit.label || 'Unnamed quote'}
                    </Link>
                    {r.unit.quotes.length > 1 && <span className="pt-sub">{r.unit.quotes.length} deals, one decision</span>}
                    {r.unit.pushes > 0 && <span className="pt-sub">pushed {r.unit.pushes === 1 ? 'once' : r.unit.pushes === 2 ? 'twice' : `${r.unit.pushes} times`}</span>}
                  </th>
                  <td className="pt-r">{fmtCredit(plan, r.credit)}</td>
                  <td className="pt-r">{fmtMoney(r.pay)}</td>
                  <td>
                    <div className="co-calls pt-calls" role="group" aria-label={`Your call on ${r.unit.label || 'this quote'}`}>
                      {CALLS.map((c) => (
                        <button key={c.key} type="button" aria-pressed={r.unit.forecast === c.key} className={`co-call is-${c.key}`} onClick={() => call(r, c.key)}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <label className={`co-date pt-date${past ? ' is-past' : ''}`}>
                      <span className="sr-only">Expected close date for {r.unit.label || 'this quote'}</span>
                      <input type="date" value={r.unit.closeDate ?? ''} onChange={(e) => closeOn(r, e.target.value || null)} />
                    </label>
                  </td>
                  <td className="pt-r">{r.age}d</td>
                  <td className="pt-r">{r.idle === 0 ? 'Today' : `${r.idle}d ago`}</td>
                  <td>
                    <span className="pt-flags">
                      {r.flags.length === 0 ? <span className="pt-ok">On track</span> : r.flags.map((f) => (
                        <span key={f} className={`ph-flag is-${f}`}>
                          {FLAG_WORDS[f]}
                        </span>
                      ))}
                    </span>
                  </td>
                  {onLose && (
                    <td>
                      <select className="pt-lose" aria-label={`Mark ${r.unit.label || 'this quote'} lost`} value="" onChange={(e) => lose(r, e.target.value)}>
                        <option value="">Lost…</option>
                        {LOST_REASONS.map((l) => (
                          <option key={l.key} value={l.key}>
                            {l.label}
                          </option>
                        ))}
                        <option value="skip">No reason</option>
                      </select>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
