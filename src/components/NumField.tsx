'use client';

import { useState, type ReactNode } from 'react';

const display = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/**
 * A money or count field. Label above, `$` prefix inside the field, thousands
 * separators when it isn't focused, raw digits while it is. Enter blurs.
 * Parses on change and clamps at `min`.
 */
export default function NumField({
  id,
  label,
  value,
  onChange,
  prefix,
  min = 0,
  integer = false,
  head,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  min?: number;
  integer?: boolean;
  /** Something to sit at the right of the label row (a segmented control). */
  head?: ReactNode;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(display(value));
  const [emitted, setEmitted] = useState(value);

  // External changes (reset to the sample deal, a preset) refresh the draft.
  if (value !== emitted) {
    setEmitted(value);
    setDraft(focused ? String(value) : display(value));
  }

  function parse(raw: string) {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(n)) return min;
    const clamped = Math.max(min, n);
    return integer ? Math.round(clamped) : Math.round(clamped * 100) / 100;
  }

  function handle(raw: string) {
    setDraft(raw);
    const next = parse(raw);
    setEmitted(next);
    onChange(next);
  }

  return (
    <div className="field">
      {head ? (
        <div className="field-head">
          <label className="field-label" htmlFor={id}>{label}</label>
          {head}
        </div>
      ) : (
        <label className="field-label" htmlFor={id}>{label}</label>
      )}
      <div className={`field-box${prefix ? ' has-prefix' : ''}`}>
        {prefix && <span className="field-prefix" aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          className="field-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          disabled={disabled}
          onChange={(e) => handle(e.target.value)}
          onFocus={() => {
            setFocused(true);
            setDraft(String(value));
          }}
          onBlur={() => {
            setFocused(false);
            setDraft(display(parse(draft)));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}
