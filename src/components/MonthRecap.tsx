'use client';

import { useState, useSyncExternalStore } from 'react';
import { periodLabel, periodOf, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmtMoney } from '@/lib/format';
import { periodTotals, type Line, type Targets } from '@/components/discounts';

const LABEL: Record<Line, string> = {
  software: 'Subscription',
  services: 'Services (one-time)',
  hardware: 'Equipment (one-time)',
};
const pct0 = (n: number) => `${Math.round(n)}%`;

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** The period just before the one `periodStart` ('YYYY-MM-DD') begins. */
function previousLabel(plan: CompPlan, periodStart: string, back = 1): string {
  const [y, m] = periodStart.split('-').map(Number);
  const step = plan.period === 'quarter' ? 3 : 1;
  return periodLabel(plan.period, new Date(y, m - 1 - step * back, 15));
}

/**
 * The first week of a new period: how the last one went, at the top of the
 * page. Earned and left on the table at the same weight, each line's average
 * discount against the rep's target, and the change from the period before
 * it. Dismissed per period, in this browser.
 */
export default function MonthRecap({
  plan,
  deals,
  today,
  periodStart,
  targets = {},
}: {
  plan: CompPlan;
  deals: DealRow[];
  today: string;
  periodStart: string;
  targets?: Targets;
}) {
  const prev = previousLabel(plan, periodStart, 1);
  const before = previousLabel(plan, periodStart, 2);
  const key = `ioi:recap:${prev}`;
  // Dismissed in this browser before? Read after hydration (the server
  // can't know), so the server renders nothing and the client decides.
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => readFlag(key),
    () => true,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const hidden = stored || dismissedNow;

  const dayOfPeriod = Math.round((Date.parse(today) - Date.parse(periodStart)) / 86400000);
  const rows = deals.filter((d) => periodOf(plan.period, d.created_at) === prev);
  if (dayOfPeriod > 6 || rows.length === 0 || hidden) return null;

  const t = periodTotals(plan, rows, null);
  const beforeRows = deals.filter((d) => periodOf(plan.period, d.created_at) === before);
  const b = beforeRows.length ? periodTotals(plan, beforeRows, null) : null;
  const kept = t.earned + t.lost > 0 ? Math.round((t.earned / (t.earned + t.lost)) * 100) : 100;
  const lines = (Object.keys(t.lines) as Line[]).filter((l) => (t.lines[l]?.list ?? 0) > 0);

  const changes: string[] = [];
  if (b) {
    const d = t.lost - b.lost;
    if (Math.abs(d) >= 1) changes.push(`left on the table ${d < 0 ? 'down' : 'up'} ${fmtMoney(Math.abs(d))}`);
    for (const l of lines) {
      const now = t.lines[l]?.avg;
      const was = b.lines[l]?.avg;
      if (now !== undefined && was !== undefined && Math.round(now) !== Math.round(was)) {
        changes.push(`${LABEL[l].toLowerCase()} discounts ${pct0(was)} to ${pct0(now)}`);
      }
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(key, '1');
    } catch {}
    setDismissedNow(true);
  }

  return (
    <section className="recap" aria-labelledby="recap-h">
      <div className="recap-head">
        <h2 id="recap-h" className="recap-h">
          {prev.split(' ')[0]} recap
          <span className="recap-sub">
            {t.count} deal{t.count === 1 ? '' : 's'} · you kept {kept}% of what full price would have paid
          </span>
        </h2>
        <button type="button" className="btn-text" onClick={dismiss}>
          Dismiss
        </button>
      </div>
      <div className="recap-nums">
        <div>
          <span className="recap-k">Earned</span>
          <span className="recap-v is-earned">{fmtMoney(t.earned)}</span>
        </div>
        <div>
          <span className="recap-k">Left on the table</span>
          <span className="recap-v is-lost">{fmtMoney(t.lost)}</span>
        </div>
        {lines.map((l) => {
          const avg = t.lines[l]!.avg;
          const target = targets[l];
          return (
            <div key={l}>
              <span className="recap-k">{LABEL[l]} discount</span>
              <span className="recap-v">{pct0(avg)}</span>
              {target !== undefined && (
                <span className={`recap-t ${avg > target + 0.05 ? 'is-over' : 'is-within'}`}>
                  {avg > target + 0.05 ? `${Math.round(avg - target)} points over your ${pct0(target)} target` : `Within your ${pct0(target)} target`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {changes.length > 0 && (
        <p className="recap-vs">
          Since {before.split(' ')[0]}: {changes.join(' · ')}.
        </p>
      )}
    </section>
  );
}
