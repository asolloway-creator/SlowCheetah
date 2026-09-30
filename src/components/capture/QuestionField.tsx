'use client';

import { useState } from 'react';
import type { Question } from '@/lib/plan-record/copy';

/**
 * One follow-up question: a set of choices applied on tap, or a number with
 * its unit, applied on Enter or "Use this". Every answer comes from a fixed
 * list or a number, never free text, so nothing typed here can carry a name.
 */
export default function QuestionField({
  q,
  onApply,
  autoFocus = false,
}: {
  q: Question;
  onApply: (value: string | number) => void;
  autoFocus?: boolean;
}) {
  const id = `q-${q.topic}-${q.index}`;
  const [draft, setDraft] = useState(q.kind === 'number' && q.current !== null ? String(q.current) : '');

  if (q.kind === 'choice') {
    return (
      <fieldset className="cap-question">
        <legend className="cap-question-prompt">{q.prompt}</legend>
        <div className="cap-choices">
          {q.choices.map((c) => (
            <button
              key={c.value}
              type="button"
              className="cap-choice"
              aria-pressed={q.current === c.value}
              onClick={() => onApply(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  const n = parseFloat(draft.replace(/[^0-9.]/g, ''));
  const valid = Number.isFinite(n) && n > 0 && n <= q.max;
  const apply = () => {
    if (valid) onApply(Math.round(n * 100) / 100);
  };
  return (
    <div className="cap-question">
      <label className="cap-question-prompt" htmlFor={id}>
        {q.prompt}
      </label>
      <div className="cap-number">
        <div className={`field-box${q.prefix ? ' has-prefix' : ''}${q.suffix ? ' has-suffix' : ''}`}>
          {q.prefix && (
            <span className="field-prefix" aria-hidden="true">
              {q.prefix}
            </span>
          )}
          <input
            id={id}
            className="field-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
          />
          {q.suffix && (
            <span className="field-suffix" aria-hidden="true">
              {q.suffix}
            </span>
          )}
        </div>
        <button type="button" className="btn btn-secondary" disabled={!valid} onClick={apply}>
          Use this
        </button>
      </div>
    </div>
  );
}
