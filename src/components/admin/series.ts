import type { Range } from '@/lib/admin';

const DAY = 86_400_000;

export const dayKey = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const keyToUtc = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const dayLabel = (k: string) =>
  new Date(keyToUtc(k)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function when(iso: string | null, tz: string) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz });
}

/** Every day in range, zero-filled, capped at the most recent 60. */
export function daySeries(daily: { day: string; visitors: number }[], range: Range, tz: string) {
  const today = dayKey(new Date(), tz);
  const byDay = new Map(daily.map((d) => [d.day, d.visitors]));
  const span = range === '7d' ? 7 : range === '30d' ? 30 : daily.length ? Math.round((keyToUtc(today) - keyToUtc(daily[0].day)) / DAY) + 1 : 1;
  const n = Math.min(60, Math.max(1, span));
  return Array.from({ length: n }, (_, i) => {
    const k = new Date(keyToUtc(today) - (n - 1 - i) * DAY).toISOString().slice(0, 10);
    return { label: dayLabel(k), value: byDay.get(k) ?? 0 };
  });
}
