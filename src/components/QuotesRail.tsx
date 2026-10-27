'use client';

import { useState } from 'react';
import { calc, pipeline, type CompPlan, type DealInput, type PeriodToDate, type QuarterToDate, type Quote } from '@/lib/calc';
import { fmt, fmtCredit, fmtMoney, periodNoun } from '@/lib/format';
import { tierName } from '@/components/opening';

/** A quote's own label, or what it is when it has none: "$2,084/mo · 2 units". */
export function quoteLabel(q: { name: string; deal: DealInput }): string {
  if (q.name.trim()) return q.name.trim();
  const mrr = q.deal.subMode === 'acv' ? q.deal.subscription / 12 : q.deal.subscription;
  return `${fmt(mrr)}/mo${q.deal.units > 1 ? ` · ${q.deal.units} units` : ''}`;
}

/** "$9,000 a year · 2 units", what a quote is when its name doesn't say. */
function sizeOf(d: DealInput): string {
  const year = d.subMode === 'acv' ? d.subscription : d.subscription * 12;
  const parts = [`${fmt(year)} a year`];
  if (d.units > 1) parts.push(`${d.units} units`);
  if (d.oneTime > 0) parts.push(`${fmt(d.oneTime)} one-time`);
  if ((d.hardware ?? 0) > 0) parts.push(`${fmt(d.hardware as number)} hardware`);
  return parts.join(' · ');
}

/**
 * Your pipeline, on the left of the home page: "New deal", then each open
 * quote with what it would pay if it closed today (the card's own headline
 * figure; anything it would unlock on deals already closed is in the total),
 * the one on the card marked, and what they all add up to if they close as
 * quoted (calc.ts pipeline, oldest first).
 */
export default function QuotesRail({
  plan,
  ptd,
  qtd,
  quotes,
  activeId,
  onOpen,
  onNew,
  compact = false,
  onWon,
  onLost,
  busy = false,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  quotes: Quote[];
  activeId: string | null;
  onOpen: (q: Quote) => void;
  onNew: () => void;
  /** In the product: a quiet list label, with "New deal" up in the page head. */
  compact?: boolean;
  /** Close a quote straight from the list: book it today, or drop it. */
  onWon?: (q: Quote) => void;
  onLost?: (q: Quote) => void;
  busy?: boolean;
}) {
  const noun = periodNoun(plan);
  const head = compact ? (
    <div className="pipe-head">
      <h2 id="pipe-h" className="app-label">
        Open quotes{quotes.length > 0 && <span className="app-count">{quotes.length}</span>}
      </h2>
    </div>
  ) : (
    <div className="pipe-head">
      <h2 id="pipe-h" className="pipe-h">
        Your pipeline
      </h2>
      <button type="button" className="btn btn-primary pipe-new" onClick={onNew}>
        + New deal
      </button>
    </div>
  );
  if (!quotes.length) {
    return (
      <section className="pipe" aria-labelledby="pipe-h">
        {head}
        <p className="pipe-empty">
          {compact
            ? 'None yet. Price a deal and save it as a quote to keep it here until it closes.'
            : 'No open quotes yet. Price a deal below, then save it as a quote to keep it here until it closes.'}
        </p>
      </section>
    );
  }
  const p = pipeline(
    plan,
    ptd,
    qtd,
    [...quotes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((q) => q.deal),
  );
  const hasAccel = plan.accelerator_style !== 'none';
  const kicker = plan.quarterly_kicker;
  const tierNum = (attainmentPct: number) =>
    kicker ? [...kicker.tiers].sort((a, b) => a.attainmentPct - b.attainmentPct).findIndex((t) => t.attainmentPct === attainmentPct) + 1 : 1;

  const lead = p.count === 1 ? 'If it closes' : p.count === 2 ? 'If both close' : `If all ${p.count} close`;
  let sum = `${lead} as quoted: ${fmtMoney(p.commission - p.unlocked)} in commission${
    p.unlocked > 0 ? `, plus ${fmtMoney(p.unlocked)} unlocked on deals you’ve already closed` : ''
  }. The ${noun} lands at ${fmtCredit(plan, p.creditAfter)}`;
  if (hasAccel) {
    // Past a step they weren't before, or short of the next one up.
    const which = p.accelerated ? 'next accelerator step' : 'accelerator';
    sum += p.crossesAccelerator
      ? ', past your accelerator'
      : p.next
        ? `, ${fmtCredit(plan, Math.max(0, p.next.threshold - p.creditAfter))} short of your ${which}`
        : '';
  }
  sum += '.';
  if (p.kicker) {
    if (p.kicker.tier) sum += ` ${tierName(tierNum(p.kicker.tier.attainmentPct))}: ${fmtMoney(p.kicker.bumpValue)}.`;
    else if (p.kicker.nextTier) sum += ` ${fmt(p.kicker.toNextTierArr)} more new ARR unlocks your Quarterly Bonus.`;
  }

  return (
    <section className="pipe" aria-labelledby="pipe-h">
      {head}
      <ul className="pipe-list">
        {quotes.map((q) => (
          <QuoteRow
            key={q.id}
            q={q}
            pay={calc(plan, q.deal, ptd)}
            active={q.id === activeId}
            onOpen={onOpen}
            onWon={onWon}
            onLost={onLost}
            busy={busy}
          />
        ))}
      </ul>
      <p className="pipe-sum">{sum}</p>
    </section>
  );
}

/** "today", "1 day", "15 days": how long a quote has been open. */
function openFor(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  return days === 0 ? 'Saved today' : `Open ${days} ${days === 1 ? 'day' : 'days'}`;
}

/** One open quote: open it in the card, or close it right here. */
function QuoteRow({
  q,
  pay,
  active,
  onOpen,
  onWon,
  onLost,
  busy,
}: {
  q: Quote;
  pay: ReturnType<typeof calc>;
  active: boolean;
  onOpen: (q: Quote) => void;
  onWon?: (q: Quote) => void;
  onLost?: (q: Quote) => void;
  busy: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className={`pipe-item${active ? ' is-active' : ''}`}>
      <button type="button" className="pipe-row" aria-pressed={active} onClick={() => onOpen(q)}>
        <span className="pipe-row-main">
          <span className="pipe-row-name">{quoteLabel(q)}</span>
          <span className="pipe-row-size">
            {sizeOf(q.deal)}
            {pay.crossesAccelerator ? ' · crosses your accelerator' : ''}
          </span>
        </span>
        {/* The same figure the card leads with: what this deal earns. */}
        <span className="pipe-row-pay">{fmtMoney(pay.commissionEffective)}</span>
      </button>
      {(onWon || onLost) && (
        <div className="pipe-row-foot">
          <span className="pipe-age">{openFor(q.createdAt)}</span>
          {confirming ? (
            <span className="pipe-acts">
              Remove it?
              <button type="button" className="pipe-act" disabled={busy} onClick={() => onLost?.(q)}>
                Yes, lost
              </button>
              <button type="button" className="pipe-act" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </span>
          ) : (
            <span className="pipe-acts">
              {onWon && (
                <button type="button" className="pipe-act is-won" disabled={busy} onClick={() => onWon(q)}>
                  Won
                </button>
              )}
              {onLost && (
                <button type="button" className="pipe-act" disabled={busy} onClick={() => setConfirming(true)}>
                  Lost
                </button>
              )}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
