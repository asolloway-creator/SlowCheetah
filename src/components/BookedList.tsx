'use client';

import { useState } from 'react';
import { periodLabel, periodOf, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmtDate, fmtMoney, fmtPctShort, periodNoun } from '@/lib/format';

const hardware = (d: DealRow) => (d.hardware_amount ?? 0) * (1 - (d.hardware_discount_pct ?? 0) / 100);
const dealValue = (d: DealRow) => d.one_time_amount * (1 - d.one_time_discount_pct / 100) + hardware(d) + d.arr;
const blendedDisc = (d: DealRow) => {
  const full = d.one_time_amount + (d.hardware_amount ?? 0) + (d.subscription_mode === 'acv' ? d.subscription_amount : d.subscription_amount * 12);
  return full > 0 ? ((full - dealValue(d)) / full) * 100 : 0;
};

/**
 * What's been booked, under the deal fields on the home page: this period's
 * deals, with what each paid and what its discount cost; "Show all" opens
 * every earlier period in place. Replaces the separate Booked page.
 */
export default function BookedList({
  plan,
  deals,
  onDelete,
}: {
  plan: CompPlan;
  deals: DealRow[];
  onDelete: (id: string) => Promise<{ error?: string }>;
}) {
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
  const lost = now.reduce((n, d) => n + d.money_left_on_table, 0);
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
          Booked this {noun}
        </h2>
        {now.length > 0 && (
          <p className="booked-sum">
            {now.length} deal{now.length === 1 ? '' : 's'} · {fmtMoney(paid)} in commission
            {lost > 0 && (
              <>
                {' · '}
                <span className="is-red">{fmtMoney(lost)}</span> left on the table
              </>
            )}
          </p>
        )}
      </div>
      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}
      {now.length === 0 && !all ? (
        <p className="booked-empty">Nothing booked in {current} yet. Book a deal when it closes and it lands here.</p>
      ) : (
        <div className="table-scroll">
          <table className="deals">
            <caption className="sr-only">Booked deals</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Deal value</th>
                <th scope="col">Discount</th>
                <th scope="col">Commission</th>
                <th scope="col">Left on the table</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {shown.map((g) => (
              <tbody key={g.period}>
                {all && (
                  <tr className="deals-period">
                    <th scope="colgroup" colSpan={6}>
                      {g.period}
                    </th>
                  </tr>
                )}
                {g.rows.map((d) => {
                  const disc = Math.round(blendedDisc(d) * 10) / 10;
                  return (
                    <tr key={d.id}>
                      <td>{fmtDate(d.created_at)}</td>
                      <td>{fmtMoney(dealValue(d))}</td>
                      <td className={disc > 0 ? '' : 'is-dim'}>{disc > 0 ? fmtPctShort(disc) : 'None'}</td>
                      <td>{fmtMoney(d.commission_earned)}</td>
                      <td className={d.money_left_on_table > 0 ? 'is-red' : 'is-dim'}>{fmtMoney(d.money_left_on_table)}</td>
                      <td>
                        <button
                          type="button"
                          className="row-delete"
                          aria-label={`Delete deal from ${fmtDate(d.created_at)}`}
                          disabled={busy === d.id}
                          onClick={() => void remove(d.id)}
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
      )}
      {earlier.length > 0 && (
        <button type="button" className="btn-text booked-all" onClick={() => setAll((a) => !a)}>
          {all ? `Show ${current} only` : `Show all booked deals (${deals.length})`}
        </button>
      )}
    </section>
  );
}
