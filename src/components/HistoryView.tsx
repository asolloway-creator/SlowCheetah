'use client';

import Link from 'next/link';
import { useState } from 'react';
import { periodLabel, periodOf, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmtDate, fmtMoney, fmtPctShort, periodNoun } from '@/lib/format';

const dealValue = (d: DealRow) => d.one_time_amount * (1 - d.one_time_discount_pct / 100) + d.arr;

const blendedDisc = (d: DealRow) => {
  const full =
    d.one_time_amount + (d.subscription_mode === 'acv' ? d.subscription_amount : d.subscription_amount * 12);
  return full > 0 ? ((full - dealValue(d)) / full) * 100 : 0;
};

/** Your deals: a ledger, with the period's total left on the table as the one headline. */
export default function HistoryView({
  plan,
  deals,
  onDelete,
  demo = false,
  onReset,
}: {
  plan: CompPlan;
  deals: DealRow[];
  onDelete: (id: string) => Promise<void>;
  demo?: boolean;
  onReset?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const current = periodLabel(plan.period);

  const groups: { period: string; rows: DealRow[] }[] = [];
  for (const d of deals) {
    const period = periodOf(plan.period, d.created_at);
    const g = groups.find((x) => x.period === period);
    if (g) g.rows.push(d);
    else groups.push({ period, rows: [d] });
  }
  const currentRows = groups.find((g) => g.period === current)?.rows ?? [];
  const total = currentRows.reduce((s, d) => s + d.money_left_on_table, 0);

  return (
    <div className="history">
      <h1 className="page-title">Your deals</h1>

      {deals.length === 0 ? (
        <>
          <p className="history-empty">No deals yet. Enter your first one and it will show up here, and stay here.</p>
          <p className="history-empty-link">
            <Link className="btn-text" href="/">
              Enter a deal &rarr;
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className={`history-figure${total > 0 ? ' is-red' : ''}`}>{fmtMoney(total)}</p>
          <p className="history-caption">
            left on the table in {current}, across {currentRows.length} deal{currentRows.length === 1 ? '' : 's'}.
          </p>

          <div className="table-scroll">
            <table className="deals">
              <caption className="sr-only">Deals booked</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Units</th>
                  <th scope="col">Deal value</th>
                  <th scope="col">Discount</th>
                  <th scope="col">Commission</th>
                  <th scope="col">Left on the table</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.period}>
                  {g.period !== current && (
                    <tr className="deals-period">
                      <th scope="colgroup" colSpan={7}>
                        {g.period}
                      </th>
                    </tr>
                  )}
                  {g.rows.map((d) => {
                    const disc = Math.round(blendedDisc(d) * 10) / 10;
                    const lost = d.money_left_on_table;
                    return (
                      <tr key={d.id}>
                        <td>{fmtDate(d.created_at)}</td>
                        <td>{d.units}</td>
                        <td>{fmtMoney(dealValue(d))}</td>
                        <td className={disc > 0 ? '' : 'is-dim'}>{disc > 0 ? fmtPctShort(disc) : '—'}</td>
                        <td>{fmtMoney(d.commission_earned)}</td>
                        <td className={lost > 0 ? 'is-red' : 'is-dim'}>{lost > 0 ? fmtMoney(lost) : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="row-delete"
                            aria-label={`Delete deal from ${fmtDate(d.created_at)}`}
                            disabled={busy === d.id}
                            onClick={async () => {
                              setBusy(d.id);
                              await onDelete(d.id);
                              setBusy(null);
                            }}
                          >
                            {busy === d.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </>
      )}

      {demo && (
        <p className="history-foot">
          Sample data lives in this browser.{' '}
          <button type="button" className="btn-text" onClick={onReset}>
            Reset the sample {periodNoun(plan)}
          </button>
        </p>
      )}
    </div>
  );
}
