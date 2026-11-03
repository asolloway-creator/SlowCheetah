import { calc, type CompPlan, type DealAccount, type PeriodToDate, type Quote } from '@/lib/calc';
import { closeUnits, type CloseUnit } from '@/lib/closeout';
import { daysBetween } from '@/lib/rollover';

/**
 * Pipeline health: whether the open pipeline can feed the number. How much
 * is open against what's left to book (coverage), which decisions are going
 * cold and what commission sits on them, how old the pipeline is, and how
 * often the rep wins what they decide. Pure, on the same decisions the
 * close-out uses (an account that decides as one is one decision).
 */

/** Why a decision needs a look, worst first. */
export type Flag = 'past-date' | 'pushed' | 'quiet' | 'no-date' | 'aging';
export const FLAGS: Flag[] = ['past-date', 'pushed', 'quiet', 'no-date', 'aging'];

export const FLAG_WORDS: Record<Flag, string> = {
  'past-date': 'Close date passed',
  pushed: 'Pushed again',
  quiet: 'Gone quiet',
  'no-date': 'No close date',
  aging: 'Open a long time',
};

/** Days without a touch (an edit, a call, a date) before a decision reads as quiet. */
export const QUIET_DAYS = 21;
/** Days open without a close date before that's worth a nudge. */
export const UNDATED_DAYS = 14;
/** Days open before a decision reads as old. */
export const OLD_DAYS = 60;
/** Pushes before it's a pattern, not a reschedule. */
export const PUSHES = 2;

export type UnitHealth = {
  unit: CloseUnit;
  /** Days since its first quote was saved. */
  age: number;
  /** Days since any of its quotes was last touched. */
  idle: number;
  flags: Flag[];
  /** What closing it would pay on its own, at today's standing. */
  pay: number;
  /** Credit toward quota it would add. */
  credit: number;
  /** New ARR it would add (what a Quarterly Bonus counts). */
  arr: number;
};

const day = (iso: string) => iso.slice(0, 10);

export function unitHealth(plan: CompPlan, ptd: PeriodToDate, quotes: Quote[], accounts: DealAccount[], today: string): UnitHealth[] {
  return closeUnits(quotes, accounts).map((unit) => {
    const age = Math.max(0, ...unit.quotes.map((q) => daysBetween(day(q.createdAt), today)));
    const touched = unit.quotes.map((q) => day(q.updatedAt || q.createdAt)).sort();
    const idle = Math.max(0, daysBetween(touched[touched.length - 1], today));
    const flags: Flag[] = [];
    // Pushed in the order FLAGS lists them, so the first is the worst.
    if (unit.closeDate && unit.closeDate < today) flags.push('past-date');
    if (unit.pushes >= PUSHES) flags.push('pushed');
    if (idle >= QUIET_DAYS) flags.push('quiet');
    if (!unit.closeDate && age >= UNDATED_DAYS) flags.push('no-date');
    if (age >= OLD_DAYS) flags.push('aging');
    let pay = 0;
    let credit = 0;
    let arr = 0;
    for (const q of unit.quotes) {
      const r = calc(plan, q.deal, ptd);
      pay += r.commissionEffective;
      credit += r.credit;
      arr += r.subAnnual;
    }
    return { unit, age, idle, flags, pay, credit, arr };
  });
}

/** Open pipeline against what's left to book: 2.4 means 2.4 times. Null
 *  when nothing is left to book. */
export function coverage(open: number, toGo: number): number | null {
  return toGo > 0 ? open / toGo : null;
}

export type AgeBucket = { label: string; count: number; credit: number };

/** The open pipeline by age: what's fresh, what's getting old. */
export function ageBuckets(units: UnitHealth[]): AgeBucket[] {
  const edges: [string, number, number][] = [
    ['Under 30 days', 0, 30],
    ['30 to 60', 30, 60],
    ['60 to 90', 60, 90],
    ['90 days or more', 90, Infinity],
  ];
  return edges.map(([label, lo, hi]) => {
    const inside = units.filter((u) => u.age >= lo && u.age < hi);
    return { label, count: inside.length, credit: inside.reduce((n, u) => n + u.credit, 0) };
  });
}

export type WinRate = { won: number; lost: number; rate: number | null; topReason: string | null };

/**
 * How often the rep wins what gets decided, over the last `days`: deals
 * booked (not upsells added without a quote) against quotes marked lost.
 * No rate until there are at least three decisions to read.
 */
export function winRate(
  booked: { created_at: string; kind?: 'deal' | 'upsell' }[],
  lost: { closedAt: string; reason: string | null }[],
  today: string,
  days = 90,
): WinRate {
  const inside = (iso: string) => {
    const d = daysBetween(day(iso), today);
    return d >= 0 && d < days;
  };
  const won = booked.filter((d) => d.kind !== 'upsell' && inside(d.created_at)).length;
  const lostIn = lost.filter((l) => inside(l.closedAt));
  const counts = new Map<string, number>();
  for (const l of lostIn) if (l.reason) counts.set(l.reason, (counts.get(l.reason) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const decided = won + lostIn.length;
  return { won, lost: lostIn.length, rate: decided >= 3 ? won / decided : null, topReason: top ? top[0] : null };
}
