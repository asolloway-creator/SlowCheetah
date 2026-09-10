'use client';

import Link from 'next/link';
import { useState } from 'react';
import { periodOf, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmt, fmtD, fmtDate, fmtCredit } from '@/lib/format';

export default function HistoryView({ plan, deals, onDelete }: { plan: CompPlan; deals: DealRow[]; onDelete: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const totalEarned = deals.reduce((s, d) => s + d.commission_earned, 0);
  const totalLost = deals.reduce((s, d) => s + d.money_left_on_table, 0);
  const totalArr = deals.reduce((s, d) => s + d.arr, 0);

  const dealValue = (d: DealRow) =>
    d.one_time_amount * (1 - d.one_time_discount_pct / 100) + d.implementation_amount * (1 - d.implementation_discount_pct / 100) + d.arr;
  const blendedDisc = (d: DealRow) => {
    const full = d.one_time_amount + d.implementation_amount + (d.subscription_mode === 'acv' ? d.subscription_amount : d.subscription_amount * 12);
    return full > 0 ? ((full - dealValue(d)) / full) * 100 : 0;
  };

  return (
    <>
      {deals.length > 0 && (
        <div className="card">
          <div className="card-title">All time</div>
          <div className="stat-grid">
            <div className="stat"><span className="label">Deals</span><div className="stat-value">{deals.length}</div><div className="stat-sub">{fmtCredit(plan, deals.reduce((s, d) => s + d.quota_credit, 0))} of quota credit</div></div>
            <div className="stat"><span className="label">ARR sold</span><div className="stat-value">{fmt(totalArr)}</div><div className="stat-sub">annualized, after discount</div></div>
            <div className="stat"><span className="label">Commission earned</span><div className="stat-value green">{fmtD(totalEarned)}</div><div className="stat-sub">{plan.accelerator_style === 'retro_bump' ? 'base — retro bumps land per period' : 'as booked'}</div></div>
            <div className="stat"><span className="label">Left on the table</span><div className={`stat-value${totalLost > 0 ? ' red' : ' green'}`}>{fmtD(totalLost)}</div><div className="stat-sub">what discounting cost you</div></div>
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-title">Deal history</div>
        {deals.length === 0 ? (
          <div className="empty">No deals yet.<br /><Link href="/" style={{ color: 'var(--green)' }}>Enter your first one</Link> and it will show up here, and stay here.</div>
        ) : (
          <div className="table-wrap">
            <table className="deals">
              <thead><tr><th>Date</th><th>Period</th><th>Units</th><th>Deal value</th><th>Discount</th><th>Commission</th><th>Left on table</th><th /></tr></thead>
              <tbody>
                {deals.map((d) => {
                  const disc = blendedDisc(d);
                  return (
                    <tr key={d.id}>
                      <td className="dim">{fmtDate(d.created_at)}</td>
                      <td className="dim">{periodOf(plan.period, d.created_at)}</td>
                      <td>{d.units}{d.attach ? ' +' : ''}</td>
                      <td>{fmt(dealValue(d))}</td>
                      <td className={disc > 0.05 ? 'red' : 'dim'}>{disc > 0.05 ? `${disc.toFixed(1)}%` : '—'}</td>
                      <td className="green">{fmtD(d.commission_earned)}</td>
                      <td className={d.money_left_on_table > 0 ? 'red' : 'dim'}>{fmtD(d.money_left_on_table)}</td>
                      <td><button className="link-btn" type="button" disabled={busy === d.id} onClick={async () => { setBusy(d.id); await onDelete(d.id); setBusy(null); }}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {plan.attach_enabled && <div className="card-note" style={{ marginTop: 10 }}>+ = {plan.attach_name || 'attach'} on the deal.</div>}
          </div>
        )}
      </div>
    </>
  );
}
