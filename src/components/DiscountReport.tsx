'use client';

import { useState } from 'react';
import { paysHardware, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmt, fmtMoney } from '@/lib/format';
import { costPerDollar, lostByLine, offByLine, type Line, type Targets } from '@/components/discounts';

const LABEL: Record<Line, string> = {
  software: 'Subscription',
  services: 'One-time products & services',
  hardware: 'Hardware',
};

const pct0 = (n: number) => `${Math.round(n)}%`;

/**
 * Where this period's discounts went: for each line, the average discount
 * (by dollars), what it cost the rep, and a target to try: "if it had
 * averaged 75%", what they'd have kept and the customer would have paid.
 * Built from the booked deals alone, so it's the rep's own record, not a
 * guess.
 */
export default function DiscountReport({
  plan,
  deals,
  noun,
  targets = {},
  onTarget,
}: {
  plan: CompPlan;
  deals: DealRow[];
  noun: string;
  targets?: Targets;
  onTarget?: (line: Line, pct: number | null) => Promise<{ error?: string }>;
}) {
  const lines: Line[] = ['software', 'services', ...(paysHardware(plan) ? (['hardware'] as Line[]) : [])];
  const totals = lines.map((line) => {
    let list = 0;
    let off = 0;
    let cost = 0;
    for (const d of deals) {
      const o = offByLine(plan, d)[line];
      list += o.list;
      off += o.off;
      cost += lostByLine(plan, d)[line];
    }
    const avg = list > 0 ? (off / list) * 100 : 0;
    const perDollar = off > 0 ? cost / off : costPerDollar(plan, line);
    return { line, list, off, cost, avg, perDollar };
  });
  const shown = totals.filter((t) => t.list > 0);
  const lost = deals.reduce((n, d) => n + d.money_left_on_table, 0);
  const paid = deals.reduce((n, d) => n + d.commission_earned, 0);
  const share = paid + lost > 0 ? Math.round((lost / (paid + lost)) * 100) : 0;
  if (!shown.length || lost < 0.005) return null;

  return (
    <section className="disc-report" aria-labelledby="disc-h">
      <div className="disc-head">
        <h3 id="disc-h" className="app-label">
          Where your discounts went
        </h3>
        <p className="disc-total">
          <span className="is-red">{fmtMoney(lost)}</span> left on the table this {noun}, {share}% of what these deals
          would have paid at full price.
        </p>
      </div>
      {/* The trade a rep makes on every deal: which line a point of discount
          is cheapest on, at this period's own mix and rate. */}
      {shown.length > 1 && (
        <p className="disc-point">
          One point of discount costs you about{' '}
          {shown.map((t, i) => (
            <span key={t.line}>
              {i > 0 && (i === shown.length - 1 ? ' and ' : ', ')}
              <b>{fmt((t.perDollar * t.list) / 100)}</b> on {LABEL[t.line].toLowerCase()}
            </span>
          ))}
          .
        </p>
      )}
      <div className="disc-lines">
        {shown.map((t) => (
          <DiscountLine
            key={t.line}
            label={LABEL[t.line]}
            {...t}
            noun={noun}
            saved={targets[t.line]}
            onSave={onTarget ? (pct) => onTarget(t.line, pct) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function DiscountLine({
  label,
  list,
  off,
  cost,
  avg,
  perDollar,
  noun,
  saved,
  onSave,
}: {
  label: string;
  noun: string;
  /** The rep's saved target for this line, if any. */
  saved?: number;
  onSave?: (pct: number | null) => Promise<{ error?: string }>;
  list: number;
  off: number;
  cost: number;
  avg: number;
  perDollar: number;
}) {
  // Their own target when they've set one; otherwise one worth trying,
  // about fifteen points under where it is now.
  const [target, setTarget] = useState(() => saved ?? Math.max(0, Math.floor(avg / 5) * 5 - 15));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(pct: number | null) {
    if (!onSave) return;
    setBusy(true);
    setError(null);
    let res: { error?: string };
    try {
      res = await onSave(pct);
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setBusy(false);
    if (res.error) setError(res.error);
  }
  const overSaved = saved !== undefined ? Math.round((avg - saved) * 10) / 10 : null;
  const offAtTarget = (target / 100) * list;
  const keep = cost - perDollar * offAtTarget;
  const collected = off - offAtTarget;
  const below = target < avg - 0.05;
  const id = `disc-${label.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <div className="disc-line">
      <p className="disc-name">{label}</p>
      <p className="disc-avg">
        <b>{pct0(avg)}</b> average discount
      </p>
      {saved !== undefined && overSaved !== null && (
        <p className={`disc-vs${overSaved > 0 ? ' is-over' : ''}`}>
          {overSaved > 0
            ? `${Math.round(overSaved)} ${Math.round(overSaved) === 1 ? 'point' : 'points'} over your ${pct0(saved)} target this ${noun}`
            : `Within your ${pct0(saved)} target this ${noun}`}
        </p>
      )}
      <p className="disc-cost">
        {fmt(off)} off {fmt(list)} list · cost you <span className="is-red">{fmtMoney(cost)}</span>
      </p>
      <div className="disc-try">
        <label className="disc-try-label" htmlFor={id}>
          {saved !== undefined && Math.abs(saved - target) < 0.05 ? 'At your target' : 'If it averaged'} <b>{target}%</b>
        </label>
        <input
          id={id}
          className="disc-range"
          type="range"
          min={0}
          max={100}
          step={1}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
        />
        {onSave && (
          <p className="disc-set">
            {saved === undefined || Math.abs(saved - target) > 0.05 ? (
              <button type="button" className="btn-text" disabled={busy} onClick={() => void save(target)}>
                {busy ? 'Saving…' : `Make ${target}% my target`}
              </button>
            ) : (
              <>
                <span>Your target</span>{' '}
                <button type="button" className="btn-text" disabled={busy} onClick={() => void save(null)}>
                  {busy ? 'Clearing…' : 'Clear it'}
                </button>
              </>
            )}
            {error && <span className="is-red"> {error}</span>}
          </p>
        )}
        <p className="disc-if" aria-live="polite">
          {below ? (
            <>
              You&rsquo;d keep <span className="is-green">+{fmtMoney(keep)}</span> · customers pay {fmt(collected)} more
            </>
          ) : (
            <>That&rsquo;s at or above where it is now, {pct0(avg)}.</>
          )}
        </p>
      </div>
    </div>
  );
}
