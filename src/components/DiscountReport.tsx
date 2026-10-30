'use client';

import { useState } from 'react';
import { sellsEquipment, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmt, fmtMoney } from '@/lib/format';
import { costPerDollar, LINES, lostNow, offByLine, type Line, type PeriodTotals, type Targets } from '@/components/discounts';

const LABEL: Record<Line, string> = {
  software: 'Subscription',
  services: 'Services (one-time)',
  hardware: 'Equipment (one-time)',
};

const pct0 = (n: number) => `${Math.round(n)}%`;
const points = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? 'point' : 'points'}`;

/**
 * Where the period's discounts went: one tile per line, built like the
 * cards at the top of the page. The average discount (by dollars) and what
 * it left on the table at the same weight; what one point costs; and the
 * rep's own target, with a what-if to set or change it.
 */
export default function DiscountReport({
  plan,
  deals,
  noun,
  targets = {},
  onTarget,
  lift = 1,
  last = null,
}: {
  plan: CompPlan;
  deals: DealRow[];
  noun: string;
  targets?: Targets;
  onTarget?: (line: Line, pct: number | null) => Promise<{ error?: string }>;
  /** See rateLift: what each discount costs at the rate the period pays. */
  lift?: number;
  /** The period before, to compare each line's average against. */
  last?: { label: string; totals: PeriodTotals } | null;
}) {
  const lines: Line[] = ['software', 'services', ...(sellsEquipment(plan) ? (['hardware'] as Line[]) : [])];
  const tiles = lines
    .map((line) => {
      let list = 0;
      let off = 0;
      let cost = 0;
      for (const d of deals) {
        const o = offByLine(plan, d)[line];
        list += o.list;
        off += o.off;
        cost += lostNow(plan, d, lift)[line];
      }
      const perDollar = off > 0 ? cost / off : costPerDollar(plan, line);
      return { line, list, off, cost, avg: list > 0 ? (off / list) * 100 : 0, perDollar, perPoint: (perDollar * list) / 100 };
    })
    .filter((t) => t.list > 0);
  if (!tiles.length) return null;

  // The period in one line: everything its discounts cost, what holding to
  // the rep's own targets would have kept, the deal that cost the most, and
  // the period before, so the number reads as something to move.
  const total = tiles.reduce((n, t) => n + t.cost, 0);
  const withTarget = tiles.filter((t) => targets[t.line] !== undefined);
  const keep = withTarget.reduce((n, t) => n + Math.max(0, t.cost - t.perDollar * (((targets[t.line] as number) / 100) * t.list)), 0);
  const perDeal = deals
    .map((d) => ({ d, cost: LINES.reduce((n, l) => n + lostNow(plan, d, lift)[l], 0) }))
    .sort((a, b) => b.cost - a.cost);
  // Only worth naming when there's more than one deal it could be.
  const top = perDeal.filter((x) => x.cost >= 1).length >= 2 ? perDeal[0] : null;
  const lastLost = last?.totals.lost;

  return (
    <section className="dt" aria-labelledby="dt-h">
      <h3 id="dt-h" className="app-label">
        Where your discounts went
      </h3>
      <div className="dt-sum">
        <div>
          <span className="dt-k">Left on the table this {noun}</span>
          <span className={`dt-v ${total >= 0.005 ? 'is-lost' : 'is-zero'}`}>{fmtMoney(total)}</span>
          <span className="dt-sum-c">{tiles.map((t) => `${LABEL[t.line]} ${fmtMoney(t.cost)}`).join(' · ')}</span>
        </div>
        {withTarget.length > 0 && (
          <div>
            <span className="dt-k">Held to your targets</span>
            <span className={`dt-v ${keep >= 0.5 ? 'is-green' : 'is-zero'}`}>{keep >= 0.5 ? `+${fmtMoney(keep)}` : '$0'}</span>
            <span className="dt-sum-c">{keep >= 0.5 ? 'more you would have kept' : 'You were within every target'}</span>
          </div>
        )}
        {top && (
          <div>
            <span className="dt-k">Cost the most</span>
            <span className="dt-v dt-v-name" title={top.d.name || undefined}>
              {top.d.name || 'Unnamed deal'}
            </span>
            <span className="dt-sum-c">
              {fmtMoney(top.cost)}, {Math.round((top.cost / Math.max(total, 0.01)) * 100)}% of the {noun}&rsquo;s total
            </span>
          </div>
        )}
        {lastLost !== undefined && last && (
          <div>
            <span className="dt-k">{last.label}</span>
            <span className="dt-v">{fmtMoney(lastLost)}</span>
            <span className={`dt-sum-c ${total < lastLost - 0.5 ? 'is-green' : total > lastLost + 0.5 ? 'is-red' : ''}`}>
              {Math.abs(total - lastLost) < 0.5
                ? 'The same so far'
                : total < lastLost
                  ? `${fmtMoney(lastLost - total)} less so far this ${noun}`
                  : `${fmtMoney(total - lastLost)} more so far this ${noun}`}
            </span>
          </div>
        )}
      </div>
      <div className="dt-grid">
        {tiles.map((t) => (
          <Tile
            key={t.line}
            label={LABEL[t.line]}
            {...t}
            noun={noun}
            lastAvg={last?.totals.lines[t.line]?.avg}
            lastLabel={last?.label}
            saved={targets[t.line]}
            onSave={onTarget ? (pct) => onTarget(t.line, pct) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function Tile({
  label,
  list,
  off,
  cost,
  avg,
  perDollar,
  perPoint,
  noun,
  saved,
  onSave,
  lastAvg,
  lastLabel,
}: {
  label: string;
  lastAvg?: number;
  lastLabel?: string;
  list: number;
  off: number;
  cost: number;
  avg: number;
  perDollar: number;
  perPoint: number;
  noun: string;
  saved?: number;
  onSave?: (pct: number | null) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(() => saved ?? Math.max(0, Math.floor(avg / 5) * 5 - 15));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const over = saved !== undefined ? avg - saved : null;

  // What the month would have kept at the target being tried.
  const offAtTarget = (target / 100) * list;
  const keep = cost - perDollar * offAtTarget;
  const collected = off - offAtTarget;

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
    if (res.error) return setError(res.error);
    setEditing(false);
  }

  const id = `dt-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="dt-tile">
      <p className="dt-name">{label}</p>
      <div className="dt-nums">
        <div>
          <span className="dt-k">Average discount</span>
          <span className="dt-v">{pct0(avg)}</span>
          {lastAvg !== undefined && (
            <span className={`dt-last ${avg < lastAvg - 0.5 ? 'is-better' : avg > lastAvg + 0.5 ? 'is-worse' : ''}`}>
              {lastLabel}: {pct0(lastAvg)}
            </span>
          )}
        </div>
        <div>
          <span className="dt-k">Left on the table</span>
          <span className={`dt-v ${cost >= 0.005 ? 'is-lost' : 'is-zero'}`}>{fmtMoney(cost)}</span>
        </div>
      </div>
      <p className="dt-note">
        {fmt(off)} off {fmt(list)} list · a point costs you {fmt(perPoint)}
      </p>

      {!editing ? (
        <div className="dt-target">
          <span className={over === null ? 'is-none' : over > 0.05 ? 'is-over' : 'is-within'}>
            {over === null
              ? 'No target yet'
              : over > 0.05
                ? `${points(over)} over your ${pct0(saved as number)} target`
                : `Within your ${pct0(saved as number)} target`}
          </span>
          {onSave && (
            <button type="button" className="btn-text" onClick={() => setEditing(true)}>
              {saved === undefined ? 'Set a target' : 'Change'}
            </button>
          )}
        </div>
      ) : (
        <div className="dt-edit">
          <label className="dt-edit-label" htmlFor={id}>
            Target <b>{target}%</b>
          </label>
          <input
            id={id}
            className="dt-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
          <p className="dt-if" aria-live="polite">
            {target < avg - 0.05 ? (
              <>
                At {target}% this {noun}: you&rsquo;d keep <span className="is-green">+{fmtMoney(keep)}</span> · customers pay{' '}
                {fmt(collected)} more
              </>
            ) : (
              <>At or above where it is now, {pct0(avg)}.</>
            )}
          </p>
          <div className="dt-edit-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save(target)}>
              {busy ? 'Saving…' : 'Save target'}
            </button>
            {saved !== undefined && (
              <button type="button" className="btn-text" disabled={busy} onClick={() => void save(null)}>
                Clear it
              </button>
            )}
            <button type="button" className="btn-text" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
          {error && <p className="is-red">{error}</p>}
        </div>
      )}
    </div>
  );
}
