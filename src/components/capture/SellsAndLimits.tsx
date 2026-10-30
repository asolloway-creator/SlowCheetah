'use client';

import { useState } from 'react';
import { paysHardware, sellsEquipment, type CompPlan, type LineLimits } from '@/lib/calc';

type Key = 'software' | 'services' | 'hardware';
export type PlanSetup = { sellsEquipment: boolean; limits: LineLimits };

const LINES: { key: Key; name: string; hint: string }[] = [
  { key: 'software', name: 'Subscription', hint: 'Recurring' },
  { key: 'services', name: 'Services', hint: 'One-time: onboarding, setup, implementation, training' },
  { key: 'hardware', name: 'Equipment', hint: 'One-time: hardware, devices' },
];

/**
 * What the rep sells (Equipment as its own one-time line, or not) and the
 * company's discount limits per line, with the plan: policy that holds on
 * every deal, so it's set once here instead of remembered deal by deal.
 * Saves as it changes. A blank limit means none; 0 means no discount at all.
 */
export default function SellsAndLimits({ plan, onSave }: { plan: CompPlan; onSave: (s: PlanSetup) => Promise<{ error?: string }> }) {
  const ownRate = paysHardware(plan);
  const [equip, setEquip] = useState(sellsEquipment(plan));
  const [limits, setLimits] = useState<LineLimits>(plan.limits ?? {});
  const [drafts, setDrafts] = useState<Partial<Record<Key, string>>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function save(next: PlanSetup) {
    setStatus('saving');
    setError(null);
    let res: { error?: string };
    try {
      res = await onSave(next);
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    if (res.error) {
      setStatus('error');
      setError(res.error);
    } else setStatus('saved');
  }

  function setLimit(key: Key, value: number | undefined) {
    const next = { ...limits };
    if (value === undefined) delete next[key];
    else next[key] = Math.min(100, Math.max(0, Math.round(value * 10) / 10));
    setLimits(next);
    setDrafts((d) => ({ ...d, [key]: undefined }));
    void save({ sellsEquipment: equip, limits: next });
  }

  function commit(key: Key) {
    const raw = drafts[key];
    if (raw === undefined) return;
    const t = raw.trim();
    if (!t) return setLimit(key, undefined);
    const n = parseFloat(t.replace(/[^0-9.]/g, ''));
    setLimit(key, Number.isFinite(n) ? n : undefined);
  }

  const shown = LINES.filter((l) => l.key !== 'hardware' || equip);

  return (
    <section className="cap-context sl" aria-labelledby="sl-h">
      <h2 id="sl-h" className="section-h">
        What you sell, and your company&rsquo;s discount limits
      </h2>
      <p className="cap-context-note">
        IOI shows a limit on every deal and never suggests a discount past it. Leave a line blank if your company doesn&rsquo;t cap it.
      </p>

      <div className="sl-equip">
        <span className="sl-q">Do you sell equipment (hardware, devices) as a one-time charge?</span>
        <span className="seg" role="group" aria-label="Sell equipment">
          <button
            type="button"
            aria-pressed={equip}
            onClick={() => {
              if (equip) return;
              setEquip(true);
              void save({ sellsEquipment: true, limits });
            }}
          >
            Yes
          </button>
          <button
            type="button"
            aria-pressed={!equip}
            disabled={ownRate}
            onClick={() => {
              if (!equip) return;
              setEquip(false);
              void save({ sellsEquipment: false, limits });
            }}
          >
            No
          </button>
        </span>
        {ownRate && <span className="sl-note">Your plan pays equipment its own rate, so it has its own line.</span>}
      </div>

      <ul className="sl-lines">
        {shown.map((l) => {
          const v = limits[l.key];
          const draft = drafts[l.key];
          return (
            <li key={l.key} className="sl-line">
              <div className="sl-name">
                <b>{l.name}</b>
                <span>{l.hint}</span>
              </div>
              <label className="sl-limit">
                <span className="sl-limit-k">Most off allowed</span>
                <span className="sl-limit-box">
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="No limit"
                    value={draft ?? (v === undefined ? '' : String(v))}
                    onChange={(e) => setDrafts((d) => ({ ...d, [l.key]: e.target.value }))}
                    onBlur={() => commit(l.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    aria-label={`${l.name}: most off your company allows, in percent`}
                  />
                  <span aria-hidden="true">%</span>
                </span>
              </label>
              <button type="button" className="btn-text sl-none" aria-pressed={v === 0} onClick={() => setLimit(l.key, v === 0 ? undefined : 0)}>
                {v === 0 ? 'No discount allowed' : 'None allowed'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className={`sl-status${status === 'error' ? ' is-red' : ''}`} role="status">
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved.' : status === 'error' ? error : ''}
      </p>
    </section>
  );
}
