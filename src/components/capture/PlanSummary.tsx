'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import type { CompPlan } from '@/lib/calc';
import { mapRecord, recordFromPlan } from '@/lib/plan-record/map';
import { readback } from '@/lib/plan-record/copy';
import { hasContributed } from '@/lib/plan-record/client';

const noop = () => () => {};

/** The plan IOI runs every deal on, read back, with ways to change, remove or delete it. */
export default function PlanSummary({
  plan,
  onDescribe,
  onForm,
  onForget,
  setup,
  onBack,
}: {
  plan: CompPlan;
  onDescribe: () => void;
  onForm: () => void;
  onForget: () => Promise<number | null>;
  /** What the rep sells and the company's discount limits. */
  setup?: ReactNode;
  /** Back to the pipeline: what finishing here means. */
  onBack?: () => void;
}) {
  const filed = useSyncExternalStore(noop, hasContributed, () => false);
  const [forget, setForget] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'failed'>('idle');
  const record = recordFromPlan(plan);
  const groups = readback(record, mapRecord(record));

  return (
    <div className="cap">
      <h1 className="page-title">Your plan</h1>
      <p className="plan-intro">What IOI runs every deal on. Changes to what you sell and your limits save as you make them.</p>

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

      {setup}

      {onBack && (
        <div className="cap-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onBack}>
            Done, back to your pipeline
          </button>
        </div>
      )}

      <section className="cap-change" aria-labelledby="cap-change-h">
        <h2 id="cap-change-h" className="cap-change-h">
          Has how you&rsquo;re paid changed?
        </h2>
        <p>Your plan above stays exactly as it is until you confirm a new one.</p>
        <div className="cap-change-acts">
          <button type="button" className="btn btn-secondary" onClick={onDescribe}>
            Describe the new plan
          </button>
          <button type="button" className="btn-text" onClick={onForm}>
            Adjust the numbers
          </button>
        </div>
      </section>

      {(filed || forget === 'done') && (
        <div className="cap-forget">
          {forget === 'done' ? (
            <p role="status">Removed. The plans you shared are gone from IOI. Your working plan stays here.</p>
          ) : forget === 'confirm' || forget === 'busy' || forget === 'failed' ? (
            <>
              <p>
                This removes every plan you’ve shared with IOI. Your working plan stays here so your deals still calculate.
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
                  {forget === 'busy' ? 'Removing' : 'Remove'}
                </button>
                <button type="button" className="btn-text" onClick={() => setForget('idle')}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <p>
              You’ve shared this plan anonymously. <Link href="/plans-and-privacy">How IOI handles your plan</Link> ·{' '}
              <button type="button" className="btn-text" onClick={() => setForget('confirm')}>
                Remove my plan
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
