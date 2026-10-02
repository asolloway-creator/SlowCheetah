'use client';

import { useState } from 'react';
import { COMPANY_SIZE_BANDS, needsQuarterArr, type CompPlan, type OpeningInput } from '@/lib/calc';
import OpeningFields from '@/components/OpeningFields';
import {
  CONTEXT_ROLE_LEVELS,
  EMPTY_CONTEXT,
  INDUSTRIES,
  OTE_BANDS,
  REGIONS,
  SEGMENTS,
  TENURE_BANDS,
  type PlanContext,
} from '@/lib/plan-record/schema';

/**
 * Step three: saved. Then where they already stand this period, so their
 * numbers start from their real position rather than zero (a first plan
 * only; it's edited later on the Where you stand page). Then, optionally, the
 * context that lets a plan sit next to others like it: role, customers,
 * industry, company size, time in role, region, on-target earnings. Ranges
 * and fixed lists only, never exact pay or free text. Skipping is one tap.
 */
export default function SavedStep({
  calculable,
  plan,
  onOpening,
  onContext,
  onDone,
  doneLabel,
}: {
  calculable: boolean;
  plan: CompPlan | null;
  onOpening: ((o: OpeningInput) => Promise<{ error?: string }>) | null;
  onContext: ((c: PlanContext) => Promise<void>) | null;
  onDone: () => void;
  doneLabel: string;
}) {
  const [c, setC] = useState<PlanContext>(EMPTY_CONTEXT);
  const [credit, setCredit] = useState(0);
  const [quarterArr, setQuarterArr] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const any = Object.values(c).some(Boolean);
  const set = <K extends keyof PlanContext>(k: K, v: PlanContext[K]) => setC((x) => ({ ...x, [k]: x[k] === v ? null : v }));
  const asking = calculable && plan && onOpening ? plan : null;
  const standing = Boolean(asking) && (credit > 0 || quarterArr > 0);

  const finish = async () => {
    setBusy(true);
    setError(null);
    if (asking && onOpening && standing) {
      const res = await onOpening({ credit, quarterArr: needsQuarterArr(asking) ? quarterArr : null });
      if (res.error) {
        setBusy(false);
        return setError(res.error);
      }
    }
    if (any && onContext) await onContext(c);
    setBusy(false);
    onDone();
  };

  return (
    <div className="cap">
      <p className="eyebrow cap-saved-eyebrow">
        <span className="mark-dot" aria-hidden="true" />
        Saved
      </p>
      <h1 className="page-title">{calculable ? 'Your plan is in.' : 'Your plan is saved.'}</h1>
      <p className="plan-intro">
        {calculable
          ? 'Every deal now runs on your plan: what it pays, what a discount costs you, and where your accelerator kicks in.'
          : 'IOI can’t run the numbers on it yet. It will as soon as it can, without asking you again.'}
      </p>

      {asking && (
        <section className="cap-context" aria-labelledby="cap-standing-h">
          <h2 id="cap-standing-h" className="section-h">
            Where you are right now
          </h2>
          <p className="cap-context-note">
            What you&rsquo;ve already booked, so your numbers start from where you really are. Leave it at zero to start
            fresh.
          </p>
          <OpeningFields
            plan={asking}
            credit={credit}
            quarterArr={quarterArr}
            onCredit={setCredit}
            onQuarterArr={setQuarterArr}
            idPrefix="saved-opening"
          />
        </section>
      )}

      {onContext && (
        <section className="cap-context" aria-labelledby="cap-context-h">
          <h2 id="cap-context-h" className="section-h">
            A little more about you
          </h2>
          <p className="cap-context-note">
            Optional. It helps IOI put your plan in context.
          </p>

          <ChipGroup label="Your role" options={CONTEXT_ROLE_LEVELS} value={c.role_level} onPick={(v) => set('role_level', v)} />
          <ChipGroup label="Who you sell to" options={SEGMENTS} value={c.segment} onPick={(v) => set('segment', v)} />
          <div className="field-grid cap-selects">
            <Select label="Industry" options={INDUSTRIES} value={c.industry} onPick={(v) => setC((x) => ({ ...x, industry: v }))} />
            <Select
              label="Company size"
              options={COMPANY_SIZE_BANDS as unknown as readonly (readonly [string, string])[]}
              value={c.company_size_band}
              onPick={(v) => setC((x) => ({ ...x, company_size_band: v }))}
            />
          </div>
          <ChipGroup label="Time in this role" options={TENURE_BANDS} value={c.tenure_band} onPick={(v) => set('tenure_band', v)} />
          <ChipGroup label="Where you work" options={REGIONS} value={c.region} onPick={(v) => set('region', v)} />
          <ChipGroup label="On-target earnings" options={OTE_BANDS} value={c.ote_band} onPick={(v) => set('ote_band', v)} />
        </section>
      )}

      {error && (
        <p className="cap-msg is-error" role="alert">
          {error}
        </p>
      )}
      <div className="cap-actions">
        <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={finish}>
          {any || standing ? 'Save and finish' : doneLabel}
        </button>
        {onContext && any && (
          <button type="button" className="btn-text" disabled={busy} onClick={onDone}>
            Skip this
          </button>
        )}
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T | null;
  onPick: (v: T) => void;
}) {
  return (
    <fieldset className="cap-question">
      <legend className="cap-question-prompt">{label}</legend>
      <div className="cap-choices">
        {options.map(([v, l]) => (
          <button key={v} type="button" className="cap-choice" aria-pressed={value === v} onClick={() => onPick(v)}>
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Select<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T | null;
  onPick: (v: T | null) => void;
}) {
  const id = `ctx-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-box">
        <select id={id} className="field-input" value={value ?? ''} onChange={(e) => onPick((e.target.value || null) as T | null)}>
          <option value="">Prefer not to say</option>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
