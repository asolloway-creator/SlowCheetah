'use client';

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
  if (d.oneTime + (d.hardware ?? 0) > 0) parts.push(`${fmt(d.oneTime + (d.hardware ?? 0))} one-time`);
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
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  quotes: Quote[];
  activeId: string | null;
  onOpen: (q: Quote) => void;
  onNew: () => void;
}) {
  const noun = periodNoun(plan);
  const head = (
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
          No open quotes yet. Price a deal on the right, then save it as a quote to keep it here until it closes.
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
        {quotes.map((q) => {
          const r = calc(plan, q.deal, ptd);
          return (
            <li key={q.id}>
              <button
                type="button"
                className={`pipe-row${q.id === activeId ? ' is-active' : ''}`}
                aria-pressed={q.id === activeId}
                onClick={() => onOpen(q)}
              >
                <span className="pipe-row-main">
                  <span className="pipe-row-name">{quoteLabel(q)}</span>
                  <span className="pipe-row-size">
                    {sizeOf(q.deal)}
                    {r.crossesAccelerator ? ' · crosses your accelerator' : ''}
                  </span>
                </span>
                {/* The same figure the card leads with: commission on this deal. */}
                <span className="pipe-row-pay">{fmtMoney(r.commissionEffective)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="pipe-sum">{sum}</p>
    </section>
  );
}
