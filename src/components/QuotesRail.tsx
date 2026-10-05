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

/**
 * The rep's open quotes, under the deal page's title: each with its
 * commission if it closed today (the card's own headline figure; anything it
 * would unlock on deals already closed is in the total), the one on the card
 * marked, a way to start a fresh deal, and what they all add up to if they
 * close as quoted (calc.ts pipeline, oldest first).
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
  if (!quotes.length) return null;
  const noun = periodNoun(plan);
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
    <section className="quotes" aria-labelledby="quotes-h">
      <h2 id="quotes-h" className="quotes-h">
        Open quotes
      </h2>
      <div className="quotes-list">
        {quotes.map((q) => (
          <button
            key={q.id}
            type="button"
            className={`quote-pill${q.id === activeId ? ' is-active' : ''}`}
            aria-pressed={q.id === activeId}
            onClick={() => onOpen(q)}
          >
            <span className="quote-pill-name">{quoteLabel(q)}</span>
            {/* The same figure the card leads with: commission on this deal. */}
            <span className="quote-pill-pay">{fmtMoney(calc(plan, q.deal, ptd).commissionEffective)}</span>
          </button>
        ))}
        <button type="button" className="quote-pill is-new" onClick={onNew}>
          + New deal
        </button>
      </div>
      <p className="quotes-sum">{sum}</p>
    </section>
  );
}
