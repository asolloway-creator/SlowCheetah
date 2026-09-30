'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { CompPlan } from '@/lib/calc';
import { mapRecord, recordFromPlan } from '@/lib/plan-record/map';
import { readback } from '@/lib/plan-record/copy';
import { hasContributed } from '@/lib/plan-record/client';

const noop = () => () => {};

/** The plan IOI runs every deal on, read back, with ways to change it or take it back. */
export default function PlanSummary({
  plan,
  onDescribe,
  onForm,
  onForget,
}: {
  plan: CompPlan;
  onDescribe: () => void;
  onForm: () => void;
  onForget: () => Promise<number | null>;
}) {
  const filed = useSyncExternalStore(noop, hasContributed, () => false);
  const [forget, setForget] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'failed'>('idle');
  const record = recordFromPlan(plan);
  const groups = readback(record, mapRecord(record));

  return (
    <div className="cap">
      <h1 className="page-title">Your plan</h1>
      <p className="plan-intro">What IOI runs every deal on. If it’s changed, describe it again or adjust the numbers.</p>

      <section className="cap-readback" aria-label="Your plan">
        {groups.map((g) => (
          <div key={g.title} className="cap-group">
            <h2 className="cap-group-h">{g.title}</h2>
            <ul>
              {g.lines.map((l) => (
                <li key={`${l.area}:${l.index}`} className="cap-line is-calculated">
                  <p className="cap-line-text">{l.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <div className="cap-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onDescribe}>
          Describe it again
        </button>
        <button type="button" className="btn-text" onClick={onForm}>
          Adjust the numbers
        </button>
      </div>

      {(filed || forget === 'done') && (
        <div className="cap-forget">
          {forget === 'done' ? (
            <p role="status">Done. The plans you shared are gone from IOI’s comparisons. Your working plan stays here.</p>
          ) : forget === 'confirm' || forget === 'busy' || forget === 'failed' ? (
            <>
              <p>
                This removes every plan you’ve shared from IOI’s comparisons. Your working plan stays here so your deals still
                calculate.
              </p>
              {forget === 'failed' && <p className="is-red">That didn’t go through. Try again.</p>}
              <div className="cap-forget-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={forget === 'busy'}
                  onClick={async () => {
                    setForget('busy');
                    setForget((await onForget()) === null ? 'failed' : 'done');
                  }}
                >
                  {forget === 'busy' ? 'Removing' : 'Remove my shared plans'}
                </button>
                <button type="button" className="btn-text" onClick={() => setForget('idle')}>
                  Keep them
                </button>
              </div>
            </>
          ) : (
            <p>
              You’ve shared this plan anonymously. <Link href="/plans-and-privacy">How IOI uses plans</Link> ·{' '}
              <button type="button" className="btn-text" onClick={() => setForget('confirm')}>
                Forget my plan
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
