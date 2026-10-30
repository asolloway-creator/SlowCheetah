'use client';

import { useState } from 'react';
import { calc, periodLabel, type CompPlan, type DealAccount, type DealInput, type Forecast, type PeriodToDate, type QuarterToDate, type Quote } from '@/lib/calc';
import { LINE_WORDS, suggestOffer, type OfferSuggestion } from '@/lib/offers';
import type { Line, Targets } from '@/components/discounts';
import { closeLine, closeUnits, closeWith, mustClose, type CloseLine, type CloseUnit, type LineKey } from '@/lib/closeout';
import { fmtCredit, fmtMoney } from '@/lib/format';

const calls = (period: CompPlan['period']): { key: Forecast; label: string }[] => [
  { key: 'commit', label: 'Commit' },
  { key: 'stretch', label: 'Stretch' },
  { key: 'next', label: `Next ${period}` },
];

const lineDefs = (period: CompPlan['period']): { key: LineKey; label: string; note: string }[] => [
  { key: 'commit', label: 'Commit', note: 'Only what you called Commit' },
  { key: 'stretch', label: 'With stretch', note: 'Commit and Stretch' },
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
 * the period comes to if the commits close, if the stretch ones do too, and
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
  targets = {},
  onMakeOffer,
  onWithdrawOffer,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  quotes: Quote[];
  accounts: DealAccount[];
  calendar: { today: string; periodStart: string };
  onForecast?: (ids: string[], forecast: Forecast | null) => Promise<{ error?: string }>;
  /** The rep's own discount targets: an offer never goes past them. */
  targets?: Targets;
  onMakeOffer?: (id: string, deal: DealInput, expires: string) => Promise<{ error?: string }>;
  onWithdrawOffer?: (id: string) => Promise<{ error?: string }>;
}) {
  // A call shows at once; the saved one replaces it when the page refreshes.
  const [picked, setPicked] = useState<Record<string, Forecast | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [offerBusy, setOfferBusy] = useState<string | null>(null);
  if (!quotes.length) return null;

  const withCalls = quotes.map((q) => (q.id in picked ? { ...q, forecast: picked[q.id] } : q));
  const units = closeUnits(withCalls, accounts);
  const lines = lineDefs(plan.period).map((l) => ({ ...l, line: closeLine(plan, ptd, qtd, units, l.key) }));
  const all = lines[2].line;
  const mc = mustClose(plan, ptd, qtd, all);
  const mustKeys = new Set(mc.must.map((u) => u.key));

  const end = periodEnd(calendar.periodStart, plan.period);
  const left = daysBetween(calendar.today, end);
  // An offer holds through the period's last day.
  const lastDay = new Date(Date.parse(end) - 86400000).toISOString().slice(0, 10);
  // What a sign-by offer on this decision could be, closing alongside the
  // rest of what's called (Commit and Stretch). Single quotes only for now.
  const expected = lines[1].line.units;
  const offerFor = (u: CloseUnit): OfferSuggestion | null => {
    if (u.quotes.length !== 1 || (u.forecast !== 'commit' && u.forecast !== 'stretch')) return null;
    const others = expected.filter((x) => x.key !== u.key).flatMap((x) => x.quotes.map((q) => q.deal));
    return suggestOffer(plan, ptd, qtd, u.quotes[0].deal, others, targets);
  };
  async function offer(q: Quote, deal: DealInput | null) {
    const act = deal ? onMakeOffer && (() => onMakeOffer(q.id, deal, lastDay)) : onWithdrawOffer && (() => onWithdrawOffer(q.id));
    if (!act) return;
    setOfferBusy(q.id);
    setError(null);
    let res: { error?: string };
    try {
      res = await act();
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setOfferBusy(null);
    if (res.error) setError(res.error);
  }
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
          <UnitRow
            key={u.key}
            u={u}
            plan={plan}
            ptd={ptd}
            qtd={qtd}
            must={mustKeys.has(u.key)}
            onCall={(f) => void call(u, f)}
            suggestion={onMakeOffer ? offerFor(u) : null}
            lastDay={lastDay}
            today={calendar.today}
            busy={offerBusy !== null && u.quotes.some((q) => q.id === offerBusy)}
            onOffer={(q, d) => void offer(q, d)}
          />
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
  suggestion,
  lastDay,
  today,
  busy,
  onOffer,
}: {
  u: CloseUnit;
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  must: boolean;
  onCall: (f: Forecast) => void;
  suggestion: OfferSuggestion | null;
  lastDay: string;
  today: string;
  busy: boolean;
  onOffer: (q: Quote, deal: DealInput | null) => void;
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
      <OfferLine plan={plan} q={u.quotes.length === 1 ? u.quotes[0] : null} suggestion={suggestion} lastDay={lastDay} today={today} busy={busy} onOffer={onOffer} />
    </li>
  );
}

/** 'YYYY-MM-DD' as "Sat, Oct 31". */
function dayName(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const PCT: Record<Line, 'subscriptionDiscountPct' | 'oneTimeDiscountPct' | 'hardwareDiscountPct'> = {
  software: 'subscriptionDiscountPct',
  services: 'oneTimeDiscountPct',
  hardware: 'hardwareDiscountPct',
};
const pct0 = (n: number) => `${Math.round(n * 10) / 10}%`;

/**
 * A sign-by offer on a decision: the one IOI suggests (the cheapest line for
 * what the buyer saves, inside the rep's targets, never costing quota), or
 * the one already out with its date. When there's no price room, it says so:
 * the hold-up is probably attention, not price.
 */
function OfferLine({
  plan,
  q,
  suggestion,
  lastDay,
  today,
  busy,
  onOffer,
}: {
  plan: CompPlan;
  q: Quote | null;
  suggestion: OfferSuggestion | null;
  lastDay: string;
  today: string;
  busy: boolean;
  onOffer: (q: Quote, deal: DealInput | null) => void;
}) {
  if (!q) return null;
  if (q.offer && q.offer.expires >= today) {
    const orig = q.offer.original;
    const changed = (Object.keys(PCT) as Line[]).filter((l) => Math.abs(Number(q.deal[PCT[l]] ?? 0) - Number(orig[PCT[l]] ?? 0)) > 0.01);
    return (
      <div className="co-offer is-out">
        <p>
          <b>Sign-by offer out</b>
          {changed.map((l) => ` · ${LINE_WORDS[l]} at ${pct0(Number(q.deal[PCT[l]] ?? 0))} off (was ${pct0(Number(orig[PCT[l]] ?? 0))})`).join('')} until{' '}
          {dayName(q.offer.expires)}. After that it goes back on its own.
        </p>
        <button type="button" className="btn-text" disabled={busy} onClick={() => onOffer(q, null)}>
          Withdraw it
        </button>
      </div>
    );
  }
  if (!suggestion) return null;
  if (suggestion.kind === 'none') {
    return (
      <div className="co-offer is-none">
        <p>
          {suggestion.reason === 'breaks-quota'
            ? 'The only room inside your targets is on what counts toward quota, and you are too close to the line to give it. Hold the price: if it has gone quiet, the hold-up is likely attention.'
            : 'No price room inside your targets and your company’s limits. If it has gone quiet, the hold-up is likely attention, not price: a short call to sign it together may do more.'}
        </p>
      </div>
    );
  }
  const o = suggestion.offer;
  return (
    <div className="co-offer">
      <p>
        <b>Sign-by offer:</b> {LINE_WORDS[o.line]} from {pct0(o.fromPct)} to {pct0(o.toPct)} off if signed by {dayName(lastDay)}. They save{' '}
        {fmtMoney(o.buyerSaves)}. It costs you {fmtMoney(o.cost)}
        {o.creditChange < -0.5 ? ` and ${fmtCredit(plan, -o.creditChange)} of quota credit` : ', and your quota credit doesn’t move'}.
        {o.byTarget && ` Still inside your ${pct0(o.toPct)} target.`}
      </p>
      <button type="button" className="btn btn-secondary co-offer-btn" disabled={busy} onClick={() => onOffer(q, o.deal)}>
        {busy ? 'Saving…' : 'Make the offer'}
      </button>
    </div>
  );
}
