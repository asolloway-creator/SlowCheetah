'use client';

import { useState } from 'react';
import { paysHardware, periodLabel, periodOf, periodToDateFrom, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { earnedNow, lostNow, periodTotals, rateLift, type Line, type Targets } from '@/components/discounts';
import DiscountReport from '@/components/DiscountReport';
import { fmtDate, fmtMoney, fmtPctShort, periodNoun } from '@/lib/format';

/** "Oct 26": inside a period the year is the page's own. */
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** A booked deal's size the way the plan pays on it: monthly on a plan paid
 *  in months of MRR, a year of subscription on every other. */
const sizeColumn = (plan: CompPlan) =>
  plan.commission_style === 'months_of_mrr'
    ? { label: 'Booked MRR', of: (d: DealRow) => d.arr / 12 }
    : { label: 'Booked ARR', of: (d: DealRow) => d.arr };

type LineCol = { key: Line; label: string; pct: (d: DealRow) => number };

/**
 * The period's closed deals, under the deal: first how the period's
 * discounts went (one tile per line, the same shape as the cards above),
 * then the deals themselves. One header row; each line's discount cell is
 * its percent with what it cost right under it, and each deal ends with
 * Earned and Left on the table side by side. Earlier periods open in place,
 * as they were saved.
 */
export default function BookedList({
  plan,
  deals,
  onDelete,
  onEdit,
  onCopy,
  editingId = null,
  targets = {},
  onTarget,
  lift = 1,
}: {
  plan: CompPlan;
  deals: DealRow[];
  onDelete: (id: string) => Promise<{ error?: string }>;
  /** Opens a booked deal in the card to change it. */
  onEdit?: (d: DealRow) => void;
  /** Starts a new deal from this one's numbers. */
  onCopy?: (d: DealRow) => void;
  editingId?: string | null;
  targets?: Targets;
  onTarget?: (line: Line, pct: number | null) => Promise<{ error?: string }>;
  /** This period's deals pay this much more than they were saved at (a retro
   *  accelerator, crossed): see rateLift. Earlier periods are as saved. */
  lift?: number;
}) {
  const size = sizeColumn(plan);
  const lines: LineCol[] = [
    { key: 'software', label: 'Subscription', pct: (d) => d.subscription_discount_pct },
    { key: 'services', label: 'One-time products & services', pct: (d) => d.one_time_discount_pct },
    ...(paysHardware(plan) ? [{ key: 'hardware' as const, label: 'Hardware', pct: (d: DealRow) => d.hardware_discount_pct ?? 0 }] : []),
  ];
  const [showEarlier, setShowEarlier] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = periodLabel(plan.period);
  const noun = periodNoun(plan);

  const groups: { period: string; rows: DealRow[] }[] = [];
  for (const d of deals) {
    const period = periodOf(plan.period, d.created_at);
    const g = groups.find((x) => x.period === period);
    if (g) g.rows.push(d);
    else groups.push({ period, rows: [d] });
  }
  const now = groups.find((g) => g.period === current)?.rows ?? [];
  const earlier = groups.filter((g) => g.period !== current);
  // The period just before this one, for the tiles' "last month".
  const last = earlier[0] ? periodTotals(plan, earlier[0].rows, null) : null;

  async function remove(id: string) {
    setBusy(id);
    setError(null);
    let res: { error?: string };
    try {
      res = await onDelete(id);
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setBusy(null);
    if (res.error) setError(res.error);
  }

  const table = (rows: DealRow[], rowLift: number | null, caption: string) => (
    <table className="cd-table">
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        <col className="c-name" />
        <col className="c-date" />
        <col className="c-num" />
        {lines.map((l) => (
          <col key={l.key} className={l.key === 'services' ? 'c-disc-wide' : 'c-disc'} />
        ))}
        <col className="c-num" />
        <col className="c-num" />
        <col className="c-act" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className="t-left">
            Deal
          </th>
          <th scope="col">Closed</th>
          <th scope="col">{size.label}</th>
          {lines.map((l) => (
            <th key={l.key} scope="col">
              {l.label} discount
            </th>
          ))}
          <th scope="col">Earned</th>
          <th scope="col">Left on the table</th>
          <th scope="col">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => {
          const lost = lostNow(plan, d, rowLift);
          const lostTotal = lines.reduce((n, l) => n + lost[l.key], 0);
          return (
            <tr key={d.id} className={d.id === editingId ? 'is-editing' : undefined}>
              <td className={`t-left t-name${d.name ? '' : ' is-dim'}`} title={d.name || undefined}>
                {d.name || 'Unnamed'}
              </td>
              <td className="t-date">{fmtDay(d.created_at)}</td>
              <td className="t-arr" data-label={size.label}>
                {fmtMoney(size.of(d))}
              </td>
              {lines.map((l) => {
                const p = Math.round(l.pct(d) * 10) / 10;
                const cost = lost[l.key];
                return (
                  <td key={l.key} className="t-disc" data-label={l.label}>
                    <span className={`t-pct${p > 0 ? '' : ' is-dim'}`}>{fmtPctShort(p)}</span>
                    <span className={`t-cost${cost >= 0.005 ? '' : ' is-dim'}`}>
                      {cost >= 0.005 ? `−${fmtMoney(cost)}` : '$0'}
                    </span>
                  </td>
                );
              })}
              <td className="t-earned">{fmtMoney(earnedNow(plan, d, rowLift))}</td>
              <td className={`t-lost${lostTotal >= 0.005 ? '' : ' is-dim'}`}>
                {lostTotal >= 0.005 ? `−${fmtMoney(lostTotal)}` : '$0'}
              </td>
              <td className="t-act">
                <span className="cd-actions">
                  {onEdit && (
                    <button
                      type="button"
                      className="cd-act is-edit"
                      aria-label={`Change ${d.name || `deal from ${fmtDate(d.created_at)}`}`}
                      onClick={() => onEdit(d)}
                    >
                      Edit
                    </button>
                  )}
                  {onCopy && (
                    <button
                      type="button"
                      className="cd-act"
                      aria-label={`Start a new deal from ${d.name || `the deal from ${fmtDate(d.created_at)}`}`}
                      onClick={() => onCopy(d)}
                    >
                      Copy
                    </button>
                  )}
                  <button
                    type="button"
                    className="cd-act"
                    aria-label={`Delete ${d.name || `deal from ${fmtDate(d.created_at)}`}`}
                    disabled={busy === d.id}
                    onClick={() => void remove(d.id)}
                  >
                    {busy === d.id ? 'Deleting…' : 'Delete'}
                  </button>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <section className="cd" aria-labelledby="cd-h">
      <header className="cd-head">
        <h2 id="cd-h" className="cd-h">
          Deals closed this {noun}
          {now.length > 0 && <span className="app-count">{now.length}</span>}
        </h2>
        {earlier.length > 0 && (
          <button type="button" className="btn-text" onClick={() => setShowEarlier((v) => !v)}>
            {showEarlier ? 'Hide earlier months' : `Earlier months (${deals.length - now.length})`}
          </button>
        )}
      </header>
      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}

      {now.length === 0 ? (
        <p className="cd-empty">Nothing closed in {current} yet. Book a deal when it closes and it lands here.</p>
      ) : (
        <>
          <DiscountReport
            plan={plan}
            deals={now}
            noun={noun}
            targets={targets}
            onTarget={onTarget}
            lift={lift}
            last={last && earlier[0] ? { label: earlier[0].period.split(' ')[0], totals: last } : null}
          />
          <div className="cd-scroll">{table(now, lift, `Deals closed in ${current}`)}</div>
        </>
      )}

      {showEarlier &&
        earlier.map((g) => {
          // Where that period finished: its own lift, from its own deals.
          const gl = rateLift(plan, periodToDateFrom(g.rows));
          const t = periodTotals(plan, g.rows, gl);
          const avg = (l: Line) => t.lines[l];
          return (
            <div key={g.period} className="cd-earlier">
              <h3 className="cd-period">
                {g.period}
                <span className="cd-period-sum">
                  {t.count} deal{t.count === 1 ? '' : 's'} · Earned {fmtMoney(t.earned)} · Left on the table{' '}
                  <span className="is-red">{fmtMoney(t.lost)}</span>
                  {lines
                    .filter((l) => avg(l.key))
                    .map((l) => ` · ${l.label} ${Math.round(avg(l.key)!.avg)}%`)
                    .join('')}
                </span>
              </h3>
              <div className="cd-scroll">{table(g.rows, gl, `Deals closed in ${g.period}`)}</div>
            </div>
          );
        })}
    </section>
  );
}
