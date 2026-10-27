'use client';

import { useState } from 'react';
import { paysHardware, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { fmt, fmtMoney } from '@/lib/format';
import { costPerDollar, lostNow, offByLine, type Line, type Targets } from '@/components/discounts';

const LABEL: Record<Line, string> = {
  software: 'Subscription',
  services: 'One-time products & services',
  hardware: 'Hardware',
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
}: {
  plan: CompPlan;
  deals: DealRow[];
  noun: string;
  targets?: Targets;
  onTarget?: (line: Line, pct: number | null) => Promise<{ error?: string }>;
  /** See rateLift: what each discount costs at the rate the period pays. */
  lift?: number;
}) {
  const lines: Line[] = ['software', 'services', ...(paysHardware(plan) ? (['hardware'] as Line[]) : [])];
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

  return (
    <section className="dt" aria-labelledby="dt-h">
      <h3 id="dt-h" className="app-label">
        Where your discounts went
      </h3>
      <div className="dt-grid">
        {tiles.map((t) => (
          <Tile
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
}: {
  label: string;
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
