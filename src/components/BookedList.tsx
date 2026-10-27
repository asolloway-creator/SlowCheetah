'use client';

import { Fragment, useState } from 'react';
import { paysHardware, periodLabel, periodOf, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { lostByLine, type Line } from '@/components/discounts';
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

/**
 * What's been booked, under the deal fields on the home page: this period's
 * deals, with what each paid and what its discount cost; "Show all" opens
 * every earlier period in place. Replaces the separate Booked page.
 */
export default function BookedList({
  plan,
  deals,
  onDelete,
  onEdit,
  editingId = null,
}: {
  plan: CompPlan;
  deals: DealRow[];
  onDelete: (id: string) => Promise<{ error?: string }>;
  /** Opens a booked deal in the card to change it. */
  onEdit?: (d: DealRow) => void;
  editingId?: string | null;
}) {
  const size = sizeColumn(plan);
  // Software and services side by side; hardware too when the plan pays it
  // its own rate and it has its own discount.
  const lines: { key: Line; label: string; pct: (d: DealRow) => number }[] = [
    { key: 'software', label: 'Subscription', pct: (d) => d.subscription_discount_pct },
    { key: 'services', label: 'One-time products & services', pct: (d) => d.one_time_discount_pct },
    ...(paysHardware(plan) ? [{ key: 'hardware' as const, label: 'Hardware', pct: (d: DealRow) => d.hardware_discount_pct ?? 0 }] : []),
  ];
  const cols = 5 + lines.length * 2;
  const [all, setAll] = useState(false);
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
  const paid = now.reduce((n, d) => n + d.commission_earned, 0);
  const shown = all ? groups : [{ period: current, rows: now }];

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

  return (
    <section className="booked" aria-labelledby="booked-h">
      <div className="booked-head">
        <h2 id="booked-h" className="booked-h">
          Deals closed this {noun}
        </h2>
        {/* The commission and what was left on the table are in the numbers
            above and in Where your discounts went; here, just the count. */}
        {now.length > 0 && (
          <p className="booked-sum">
            {now.length} deal{now.length === 1 ? '' : 's'} · {fmtMoney(paid)} in commission
          </p>
        )}
      </div>
      {now.length > 0 && <DiscountReport plan={plan} deals={now} noun={noun} />}
      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}
      {now.length === 0 && !all ? (
        <p className="booked-empty">Nothing booked in {current} yet. Book a deal when it closes and it lands here.</p>
      ) : (
        <div className="table-scroll">
          <table className="deals deals-table">
            <caption className="sr-only">Booked deals</caption>
            <colgroup>
              <col className="c-name" />
              <col className="c-date" />
              <col className="c-arr" />
              <col className="c-pay" />
              {lines.map((l) => (
                <Fragment key={l.key}>
                  <col className="c-pct" />
                  <col className="c-cost" />
                </Fragment>
              ))}
              <col className="c-act" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" rowSpan={2} className="t-left">
                  Deal
                </th>
                <th scope="col" rowSpan={2}>
                  Date Closed Won
                </th>
                <th scope="col" rowSpan={2}>
                  {size.label}
                </th>
                <th scope="col" rowSpan={2}>
                  Commission
                </th>
                {lines.map((l) => (
                  <th key={l.key} scope="colgroup" colSpan={2} className="t-group">
                    <span>{l.label}</span>
                  </th>
                ))}
                <th scope="col" rowSpan={2} className="t-end">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
              <tr>
                {lines.map((l) => (
                  <Fragment key={l.key}>
                    <th scope="col">Discount</th>
                    <th scope="col">Left on the table</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            {shown.map((g) => (
              <tbody key={g.period}>
                {all && (
                  <tr className="deals-period">
                    <th scope="colgroup" colSpan={cols}>
                      {g.period}
                    </th>
                  </tr>
                )}
                {g.rows.map((d) => {
                  const lost = lostByLine(plan, d);
                  return (
                    <tr key={d.id} className={`t-row${d.id === editingId ? ' is-editing' : ''}`}>
                      <td className={`t-left t-name${d.name ? '' : ' is-dim'}`} title={d.name || undefined}>
                        {d.name || 'Unnamed'}
                      </td>
                      <td className="t-date">{fmtDay(d.created_at)}</td>
                      <td className="t-arr">{fmtMoney(size.of(d))}</td>
                      <td className="t-pay">{fmtMoney(d.commission_earned)}</td>
                      {lines.map((l) => {
                        const p = Math.round(l.pct(d) * 10) / 10;
                        const cost = lost[l.key];
                        return (
                          <Fragment key={l.key}>
                            <td className={`t-pct${p > 0 ? '' : ' is-dim'}`} data-label={`${l.label} discount`}>
                              {fmtPctShort(p)}
                            </td>
                            <td className={`t-cost${cost >= 0.005 ? '' : ' is-dim'}`}>
                              {cost >= 0.005 ? `\u2212${fmtMoney(cost)}` : '$0'}
                            </td>
                          </Fragment>
                        );
                      })}
                      <td className="t-end t-act">
                        <span className="deals-actions">
                          {onEdit && (
                            <button
                              type="button"
                              className="row-delete"
                              aria-label={`Change ${d.name || `deal from ${fmtDate(d.created_at)}`}`}
                              onClick={() => onEdit(d)}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            className="row-delete"
                            aria-label={`Delete deal from ${fmtDate(d.created_at)}`}
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
            ))}
          </table>
        </div>
      )}
      {earlier.length > 0 && (
        <button type="button" className="btn-text booked-all" onClick={() => setAll((a) => !a)}>
          {all ? `Show ${current} only` : `Show all booked deals (${deals.length})`}
        </button>
      )}
    </section>
  );
}
