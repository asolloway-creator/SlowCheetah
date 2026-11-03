import type { CompPlan, DealAccount, PeriodToDate, QuarterToDate, Quote } from '@/lib/calc';
import { closeLine, mustClose } from '@/lib/closeout';
import { FLAG_WORDS, unitHealth, type Flag, type UnitHealth } from '@/lib/health';

/**
 * What needs the rep first: the open decisions ranked by how much they put
 * at risk. A decision the period can't do without comes first when the
 * period is closing; after that, the ones whose dates have passed, that keep
 * sliding, that have gone quiet, or have no call yet as the period nears its
 * end. One line each, with the commission on it and where to act.
 */

export type NeedKind = 'must' | Flag | 'uncalled';

export type Need = {
  key: string;
  /** The decision's name (an account's, or the quote's). */
  label: string;
  /** A quote to open it by. */
  quoteId: string;
  kind: NeedKind;
  /** Why it's here, in a sentence. */
  why: string;
  /** What closing it adds in commission. */
  pay: number;
  /** Higher first. */
  score: number;
};

/** The period's last week, when a missing call starts to matter. */
const CLOSING_DAYS = 7;
/** How near the end the must-close list is worth showing. */
const MUST_DAYS = 14;

const BASE: Record<Flag, number> = { 'past-date': 90, pushed: 70, quiet: 60, 'no-date': 40, aging: 30 };

const nth = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

function whyFor(h: UnitHealth, flag: Flag): string {
  switch (flag) {
    case 'past-date':
      return `Its close date has passed. Confirm a new one, or mark it lost.`;
    case 'pushed':
      return `Pushed ${nth(h.unit.pushes)}. Ask what has to happen before they sign.`;
    case 'quiet':
      return `Nothing has moved in ${h.idle} days. A short call beats another follow-up.`;
    case 'no-date':
      return `Open ${h.age} days with no close date. Ask when they want to be live.`;
    case 'aging':
      return `Open ${h.age} days. If it isn't moving, marking it lost keeps your forecast honest.`;
  }
}

/**
 * The decisions that need a look, most pressing first. `left` is the days
 * left in the period. Pass quotes as the page reads them (a close date past
 * the period already counts a quote as next period's).
 */
export function needsYou(
  plan: CompPlan,
  ptd: PeriodToDate,
  qtd: QuarterToDate | null,
  quotes: Quote[],
  accounts: DealAccount[],
  today: string,
  left: number,
): Need[] {
  const health = unitHealth(plan, ptd, quotes, accounts, today);
  const all = closeLine(plan, ptd, qtd, health.map((h) => h.unit), 'all');
  const must = left <= MUST_DAYS ? new Set(mustClose(plan, ptd, qtd, all).must.map((u) => u.key)) : new Set<string>();

  const out: Need[] = [];
  for (const h of health) {
    const u = h.unit;
    // A decision pushed to next period is next period's to chase.
    if (u.forecast === 'next') continue;
    const id = u.quotes[0].id;
    const label = u.label || 'Unnamed quote';
    const worst = h.flags[0];
    const isMust = must.has(u.key);
    if (isMust) {
      out.push({
        key: u.key,
        label,
        quoteId: id,
        kind: 'must',
        why: worst
          ? `You can't reach quota without it. ${whyFor(h, worst)}`
          : `You can't reach quota without it. ${u.closeDate ? `Expected ${shortDay(u.closeDate)}.` : 'Get a close date on it.'}`,
        pay: h.pay,
        score: 100 + (worst ? BASE[worst] / 10 : 0),
      });
    } else if (worst) {
      out.push({ key: u.key, label, quoteId: id, kind: worst, why: whyFor(h, worst), pay: h.pay, score: BASE[worst] + Math.min(9, h.pay / 500) });
    } else if (u.forecast === null && left <= CLOSING_DAYS) {
      out.push({
        key: u.key,
        label,
        quoteId: id,
        kind: 'uncalled',
        why: `${left <= 1 ? 'Last day' : `${left} days left`} and no call on it. Commit, Stretch or Next month.`,
        pay: h.pay,
        score: 80,
      });
    }
  }
  // Money breaks ties inside a kind.
  return out.sort((a, b) => b.score - a.score || b.pay - a.pay);
}

export const NEED_WORDS: Record<NeedKind, string> = { ...FLAG_WORDS, must: 'Must close', uncalled: 'No call yet' };

function shortDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
