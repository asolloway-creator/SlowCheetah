import type { Period } from '@/lib/calc';

/**
 * What carries across the line between one period and the next: the quarter
 * as one timeline (each month's share of it), and how the period just ended
 * came out. Pure, so the server computes it in the rep's own zone and the
 * page just draws it.
 */

/** An instant as 'YYYY-MM-DD' in the rep's own time zone. */
export function dayInZone(iso: string, timeZone: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type QuarterMonth = {
  /** 'YYYY-MM' */
  key: string;
  /** 'October' */
  label: string;
  /** New ARR booked that month. */
  arr: number;
  state: 'past' | 'now' | 'ahead';
};

export type QuarterView = {
  /** 'Q4 2026' */
  label: string;
  months: QuarterMonth[];
  /** New ARR in the quarter that no deal here accounts for: what the rep
   *  booked before IOI, from the starting point. */
  before: number;
};

/**
 * The calendar quarter `today` falls in, month by month. `rows` are every
 * deal the rep has booked; `quarterArr` is the quarter's total as the
 * Quarterly Bonus counts it (deals plus the starting point), so whatever
 * the deals don't explain is the part from before IOI.
 */
export function quarterView(rows: { created_at: string; arr: number }[], quarterArr: number, today: string, timeZone: string): QuarterView {
  const [y, m] = today.split('-').map(Number);
  const first = Math.floor((m - 1) / 3) * 3;
  const nowKey = today.slice(0, 7);
  const months: QuarterMonth[] = [0, 1, 2].map((i) => {
    const key = `${y}-${String(first + i + 1).padStart(2, '0')}`;
    const arr = rows.reduce((n, d) => (dayInZone(d.created_at, timeZone).slice(0, 7) === key ? n + d.arr : n), 0);
    return { key, label: MONTHS[first + i], arr, state: key < nowKey ? 'past' : key === nowKey ? 'now' : 'ahead' };
  });
  const explained = months.reduce((n, x) => n + x.arr, 0);
  return { label: `Q${first / 3 + 1} ${y}`, months, before: Math.max(0, Math.round((quarterArr - explained) * 100) / 100) };
}

/** The key and first day of the period that came just before the one that
 *  starts on `periodStart` ('YYYY-MM-DD'). */
export function previousPeriod(period: Period, periodStart: string): { key: string; start: string } {
  const [y, m] = periodStart.split('-').map(Number);
  const step = period === 'quarter' ? 3 : 1;
  const d = new Date(Date.UTC(y, m - 1 - step, 1));
  const yy = d.getUTCFullYear();
  const mm = d.getUTCMonth();
  return {
    key: period === 'quarter' ? `${yy}-Q${Math.floor(mm / 3) + 1}` : `${yy}-${String(mm + 1).padStart(2, '0')}`,
    start: d.toISOString().slice(0, 10),
  };
}

/**
 * Quota credit booked in the period just ended: its deals, plus what the rep
 * said they'd booked before IOI if that answer is still the saved one (it is
 * replaced when they answer the new period's, so this can undercount then).
 */
export function lastPeriodCredit(
  period: Period,
  periodStart: string,
  rows: { created_at: string; quota_credit: number }[],
  saved: { periodKey: string; credit: number } | null,
  timeZone: string,
): number {
  const prev = previousPeriod(period, periodStart);
  const inside = rows.filter((d) => {
    const day = dayInZone(d.created_at, timeZone);
    return day >= prev.start && day < periodStart;
  });
  return inside.reduce((n, d) => n + d.quota_credit, 0) + (saved && saved.periodKey === prev.key ? saved.credit : 0);
}

/** The first day of the period after the one that starts on `periodStart`. */
export function nextPeriodStart(period: Period, periodStart: string): string {
  const [y, m] = periodStart.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + (period === 'quarter' ? 3 : 1), 1)).toISOString().slice(0, 10);
}

/** Whole days from one 'YYYY-MM-DD' to another. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
