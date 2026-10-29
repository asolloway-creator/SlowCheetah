'use client';

import { useState } from 'react';
import { calc, periodLabel, type CompPlan, type DealAccount, type Forecast, type PeriodToDate, type QuarterToDate, type Quote } from '@/lib/calc';
import { closeLine, closeUnits, closeWith, mustClose, type CloseLine, type CloseUnit, type LineKey } from '@/lib/closeout';
import { fmtCredit, fmtMoney } from '@/lib/format';

const calls = (period: CompPlan['period']): { key: Forecast; label: string }[] => [
  { key: 'commit', label: 'Commit' },
  { key: 'likely', label: 'Likely' },
  { key: 'stretch', label: 'Stretch' },
  { key: 'next', label: `Next ${period}` },
];

const lineDefs = (period: CompPlan['period']): { key: LineKey; label: string; note: string }[] => [
  { key: 'commit', label: 'Commit', note: 'Only what you called Commit' },
  { key: 'best', label: 'Best case', note: 'Commit and Likely' },
  { key: 'all', label: 'Everything', note: `All but next ${period}, called or not` },
];

/** Whole days from one 'YYYY-MM-DD' to another. */
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** The first day after the period that starts on `start`. */
function periodEnd(start: string, period: CompPlan['period']): string {
  const [y, m] = start.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + (period === 'quarter' ? 3 : 1), 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Closing out the period, under the rep's open quotes: their own call on
 * each decision (an account that decides as one is one decision), then what
 * the period comes to if the commits close, if the likely ones do too, and
 * if everything not pushed out does. Which decisions the period can't do
 * without, and what reaching quota is worth. In the last week of the period
 * it reads "Close out"; before that, "Forecast".
 */
export default function CloseOut({
  plan,
  ptd,
  qtd,
  quotes,
  accounts,
  calendar,
  onForecast,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  quotes: Quote[];
  accounts: DealAccount[];
  calendar: { today: string; periodStart: string };
  onForecast?: (ids: string[], forecast: Forecast | null) => Promise<{ error?: string }>;
}) {
  // A call shows at once; the saved one replaces it when the page refreshes.
  const [picked, setPicked] = useState<Record<string, Forecast | null>>({});
  const [error, setError] = useState<string | null>(null);
  if (!quotes.length) return null;

  const withCalls = quotes.map((q) => (q.id in picked ? { ...q, forecast: picked[q.id] } : q));
  const units = closeUnits(withCalls, accounts);
  const lines = lineDefs(plan.period).map((l) => ({ ...l, line: closeLine(plan, ptd, qtd, units, l.key) }));
  const all = lines[2].line;
  const mc = mustClose(plan, ptd, qtd, all);
  const mustKeys = new Set(mc.must.map((u) => u.key));

  const left = daysBetween(calendar.today, periodEnd(calendar.periodStart, plan.period));
  const name = periodLabel(plan.period).split(' ')[0];
  const closing = left <= 7;
  const uncalled = units.filter((u) => u.forecast === null).length;

  async function call(u: CloseUnit, f: Forecast) {
    const next = u.forecast === f ? null : f;
    const ids = u.quotes.map((q) => q.id);
    setPicked((c) => ({ ...c, ...Object.fromEntries(ids.map((id) => [id, next])) }));
    setError(null);
    if (!onForecast) return;
    let res: { error?: string };
    try {
      res = await onForecast(ids, next);
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    if (res.error) setError(res.error);
  }

  return (
    <section className="co" aria-labelledby="co-h">
      <header className="co-head">
        <h2 id="co-h" className="cd-h">
          {closing ? `Close out ${name}` : `Forecast ${name}`}
        </h2>
        <p className="co-sub">
          {left > 0 ? `${left} ${left === 1 ? 'day' : 'days'} left` : 'Last day'} · {fmtCredit(plan, ptd.creditBooked)} booked of{' '}
          {fmtCredit(plan, plan.quota)}
          {ptd.creditBooked < plan.quota ? ` · ${fmtCredit(plan, plan.quota - ptd.creditBooked)} to go` : ' · quota reached'}
        </p>
      </header>

      <div className="co-lines">
        {lines.map((l) => (
          <LineTile key={l.key} label={l.label} note={l.note} plan={plan} line={l.line} />
        ))}
      </div>

      <p className="co-read" aria-live="polite">
        {all.hits ? (
          mc.must.length ? (
            <>
              To reach quota you can&rsquo;t lose <b>{list(mc.must.map((u) => u.label))}</b>. Everything else is cushion:{' '}
              {fmtCredit(plan, mc.cushion)} over if it all closes.
            </>
          ) : (
            <>No single decision makes or breaks quota. If everything closes you finish {fmtCredit(plan, mc.cushion)} over.</>
          )
        ) : (
          <>
            Even if everything closes, you finish <b>{fmtCredit(plan, all.gap)} short</b> of quota.
            {all.crossingWorth !== null && all.crossingWorth >= 1 && <> Reaching it would add about {fmtMoney(all.crossingWorth)} on the month.</>}
          </>
        )}
        {uncalled > 0 && (
          <span className="co-hint">
            {' '}
            {uncalled === 1 ? 'One decision has' : `${uncalled} decisions have`} no call yet, so {uncalled === 1 ? 'it counts' : 'they count'} only in
            Everything.
          </span>
        )}
      </p>

      <ul className="co-list">
        {units.map((u) => (
          <UnitRow key={u.key} u={u} plan={plan} ptd={ptd} qtd={qtd} must={mustKeys.has(u.key)} onCall={(f) => void call(u, f)} />
        ))}
      </ul>
      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

function LineTile({ label, note, plan, line }: { label: string; note: string; plan: CompPlan; line: CloseLine }) {
  const pct = plan.quota > 0 ? Math.min(100, (line.credit / plan.quota) * 100) : 0;
  return (
    <div className={`co-tile${line.hits ? ' is-hit' : ''}`}>
      <p className="co-tile-k">
        {label} <span className="co-tile-note">{note}</span>
      </p>
      <p className="co-tile-v">{fmtMoney(line.commission)}</p>
      <p className="co-tile-c">in commission this {plan.period}</p>
      <div className="co-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className={`co-tile-q ${line.hits ? 'is-green' : 'is-short'}`}>
        {line.hits ? `Quota reached, ${fmtCredit(plan, line.credit - plan.quota)} over` : `${fmtCredit(plan, line.gap)} short of quota`}
      </p>
      <p className="co-tile-f">
        {line.lost >= 0.005 ? (
          <>
            Discounts cost you <span className="is-red">{fmtMoney(line.lost)}</span>
          </>
        ) : (
          'Full price'
        )}
        {line.givenAway >= 1 && <> · prospects save {fmtMoney(line.givenAway)} the first year</>}
      </p>
    </div>
  );
}

function UnitRow({
  u,
  plan,
  ptd,
  qtd,
  must,
  onCall,
}: {
  u: CloseUnit;
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  must: boolean;
  onCall: (f: Forecast) => void;
}) {
  // This decision on its own, against where the period stands now.
  const own = closeWith(plan, ptd, qtd, u.quotes.map((q) => q.deal));
  const credit = own.after.creditBooked - ptd.creditBooked;
  // What closing it adds to the period, anything it unlocks included, and
  // how much of that is the accelerator it unlocks on everything else.
  const pay = own.commission - closeWith(plan, ptd, qtd, []).commission;
  const ownPay = u.quotes.reduce((n, q) => n + calc(plan, q.deal, ptd).commissionEffective, 0);
  const unlocks = pay - ownPay;
  const group = u.account?.oneDecision && u.quotes.length > 1;
  return (
    <li className={`co-row${must ? ' is-must' : ''}`}>
      <div className="co-row-main">
        <p className="co-row-name">
          {u.label || 'Unnamed quote'}
          {must && <span className="co-must">Must close</span>}
        </p>
        <p className="co-row-meta">
          {group ? `${u.quotes.length} deals, one decision: ${u.quotes.map((q) => q.name.trim() || 'unnamed').join(', ')}` : u.account ? `${u.account.name} account` : null}
          {(group || u.account) && ' · '}
          {fmtCredit(plan, credit)} · adds about {fmtMoney(pay)}
          {unlocks >= 1 && `, ${fmtMoney(unlocks)} of it the accelerator it unlocks`}
          {u.mixed && ' · its deals had different calls, the most cautious is used'}
        </p>
      </div>
      <div className="co-calls" role="group" aria-label={`Your call on ${u.label || 'this quote'}`}>
        {calls(plan.period).map((c) => (
          <button key={c.key} type="button" aria-pressed={u.forecast === c.key} className={`co-call is-${c.key}`} onClick={() => onCall(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
    </li>
  );
}
