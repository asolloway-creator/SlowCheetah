'use client';

import { useState } from 'react';
import { fmt } from '@/lib/format';

/** Discount slider with the prototype's click-to-type percentage. */
export default function DiscountSlider({
  id,
  label,
  value,
  baseAmount,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  baseAmount: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function commit() {
    let n = parseFloat(draft);
    if (isNaN(n)) n = 0;
    n = Math.max(0, Math.min(100, Math.round(n * 100) / 100));
    onChange(n);
    setEditing(false);
  }

  return (
    <div className="slider-wrap">
      <div className="slider-head">
        <span className="label">{label}</span>
        <div className="slider-right">
          {value > 0 && (
            <span className="slider-adjusted">{fmt(baseAmount * (1 - value / 100))}</span>
          )}
          {editing ? (
            <input
              className="inline-edit"
              type="text"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditing(false);
              }}
              aria-label={`${label} discount percent`}
            />
          ) : (
            <button
              type="button"
              className={`slider-value${value > 0 ? ' hot' : ''}`}
              onClick={() => {
                setDraft(value > 0 ? String(value) : '');
                setEditing(true);
              }}
            >
              {value}%
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        className={`slider${value > 0 ? ' active' : ''}`}
        id={id}
        value={value}
        min={0}
        max={100}
        step={0.01}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}
