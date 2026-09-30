'use client';

import { useState } from 'react';
import { COMPANY_SIZE_BANDS } from '@/lib/calc';
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
 * Step three: saved. Then, optionally, the context that lets a plan sit next
 * to others like it: role, customers, industry, company size, time in role,
 * region, on-target earnings. Ranges and fixed lists only, never exact pay
 * or free text. Skipping is one tap.
 */
export default function SavedStep({
  calculable,
  onContext,
  onDone,
  doneLabel,
}: {
  calculable: boolean;
  onContext: ((c: PlanContext) => Promise<void>) | null;
  onDone: () => void;
  doneLabel: string;
}) {
  const [c, setC] = useState<PlanContext>(EMPTY_CONTEXT);
  const [busy, setBusy] = useState(false);
  const any = Object.values(c).some(Boolean);
  const set = <K extends keyof PlanContext>(k: K, v: PlanContext[K]) => setC((x) => ({ ...x, [k]: x[k] === v ? null : v }));

  const finish = async () => {
    if (any && onContext) {
      setBusy(true);
      await onContext(c);
      setBusy(false);
    }
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

      {onContext && (
        <section className="cap-context" aria-labelledby="cap-context-h">
          <h2 id="cap-context-h" className="section-h">
            Help the comparison
          </h2>
          <p className="cap-context-note">
            Optional and anonymous. These put your plan next to others like it, and nothing is shown until at least 10 plans
            match.
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

      <div className="cap-actions">
        <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={finish}>
          {any ? 'Save and finish' : doneLabel}
        </button>
        {onContext && any && (
          <button type="button" className="btn-text" disabled={busy} onClick={onDone}>
            Skip this
          </button>
        )}
      </div>
      <p className="cap-privacy cap-privacy-plain">Comparisons unlock as more reps add their plans.</p>
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
