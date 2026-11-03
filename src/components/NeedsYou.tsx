import Link from 'next/link';
import type { CompPlan, DealAccount, PeriodToDate, QuarterToDate, Quote } from '@/lib/calc';
import { needsYou, NEED_WORDS } from '@/lib/needs';
import { fmtMoney } from '@/lib/format';

/** How many moves Home shows; the rest are one click away on Pipeline. */
const SHOWN = 3;

/**
 * Home's list of what to do first: the top few decisions that need the rep,
 * why, and what's on them, each linking to where they act. Not a report:
 * every line is a move.
 */
export default function NeedsYou({
  plan,
  ptd,
  qtd,
  quotes,
  accounts,
  today,
  left,
  openHref,
  pipelineHref,
  deskHref,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  quotes: Quote[];
  accounts: DealAccount[];
  today: string;
  left: number;
  /** A quote on the deal desk. */
  openHref: (quoteId: string) => string;
  pipelineHref: string;
  deskHref: string;
}) {
  const needs = needsYou(plan, ptd, qtd, quotes, accounts, today, left);
  const top = needs.slice(0, SHOWN);
  return (
    <section className="ny" aria-labelledby="ny-h">
      <header className="ny-head">
        <h2 id="ny-h" className="cd-h">
          Needs you
        </h2>
        {needs.length > SHOWN && (
          <Link href={pipelineHref} className="btn-text">
            {needs.length - SHOWN} more on Pipeline
          </Link>
        )}
      </header>
      {top.length > 0 ? (
        <ul className="ny-list">
          {top.map((n) => (
            <li key={n.key} className={`ny-row is-${n.kind}`}>
              <div className="ny-main">
                <p className="ny-name">
                  <Link href={openHref(n.quoteId)} className="as-deal-link">
                    {n.label}
                  </Link>
                  <span className={`ph-flag is-${n.kind === 'must' ? 'must' : n.kind}`}>{NEED_WORDS[n.kind]}</span>
                </p>
                <p className="ny-why">{n.why}</p>
              </div>
              <p className="ny-pay">
                <b>{fmtMoney(n.pay)}</b>
                <span>in commission</span>
              </p>
            </li>
          ))}
        </ul>
      ) : quotes.length > 0 ? (
        <p className="ny-clear">Nothing needs you right now. Every open decision has a date ahead and a recent touch.</p>
      ) : (
        <p className="ny-clear">
          No open quotes yet. <Link href={deskHref}>Price a deal</Link> and save it, and what needs you shows here.
        </p>
      )}
    </section>
  );
}
