'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { fmtPctShort } from '@/lib/format';

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const round2 = (n: number) => Math.round(n * 100) / 100;

// Fixed 0–100 scale — a given thumb position always means the same
// percentage, whatever the value.
const MAX = 100;
const MINOR = Array.from({ length: 21 }, (_, i) => i * 5);
const MAJOR = [0, 25, 50, 75, 100];

/**
 * A native range with a click-to-type value bubble and a "try 0%" tween.
 * Keyboard: ←/→ 0.5, Shift 5, Home/End 0/max.
 * `size="lg"` is the promoted control on the result card: a tall track
 * with a scale, and, when a quarterly bonus is at stake, the exact line
 * where it's lost. `size="sm"` is the compact one under one-time products.
 */
export default function DiscountSlider({
  id,
  label,
  value,
  onChange,
  size = 'lg',
  costsYou = 0,
  valueText,
  caption,
  aside,
  disabled = false,
  kickerBreakpointPct = null,
  costsATier = false,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  size?: 'lg' | 'sm';
  /** Dollars this discount costs the rep. On a plan with no bonus line to
   *  mark, a costly discount turns the fill red (lg). */
  costsYou?: number;
  valueText: string;
  caption?: string;
  /** Right side of the lg head row. */
  aside?: ReactNode;
  disabled?: boolean;
  /** Exact value at which this deal drops out of its quarterly-kicker tier
   *  (opening.ts's kickerCrossDiscountPct), or null when none is at stake.
   *  Only ever positions the line; never decides red, that's costsATier. lg only. */
  kickerBreakpointPct?: number | null;
  /** The engine's own crossEffect.costsATier at the live value: the single
   *  source of truth for every red state drawn here (fill, line, bubble,
   *  thumb, pulse), so none can disagree with the bonus card. lg only. */
  costsATier?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelled = useRef(false);
  const raf = useRef<number | null>(null);
  const editId = useId();

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  // One-shot pulse the instant this deal first costs its bonus tier. Seeded
  // to the initial value so a deal that starts past the line never pulses
  // on mount; never fires on the retreat back to safe.
  const wasCrossed = useRef(costsATier);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (costsATier && !wasCrossed.current && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPulse((k) => k + 1);
    }
    wasCrossed.current = costsATier;
  }, [costsATier]);

  function startEdit() {
    cancelled.current = false;
    setDraft(value > 0 ? String(value) : '');
    setEditing(true);
  }

  function commit() {
    if (cancelled.current) return;
    let n = parseFloat(draft.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(n)) n = 0;
    onChange(Math.max(0, Math.min(100, round2(n))));
    setEditing(false);
  }

  /** Tween the value to a target over 480ms; everything downstream animates from it. */
  function animateTo(target: number) {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onChange(target);
      return;
    }
    const start = value;
    const t0 = performance.now();
    const step = (ts: number) => {
      const p = Math.min(1, (ts - t0) / 480);
      onChange(p >= 1 ? target : round2(start + (target - start) * easeOut(p)));
      raf.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    raf.current = requestAnimationFrame(step);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    delete e.currentTarget.dataset.pointer;
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    onChange(Math.max(0, Math.min(MAX, round2(value + dir * (e.shiftKey ? 5 : 0.5)))));
  }

  const kx = size === 'lg' ? kickerBreakpointPct : null;
  const style = {
    '--pct': String(value),
    ...(kx != null ? { '--kx': String(kx) } : {}),
  } as CSSProperties;
  const shown = fmtPctShort(value);
  const cls = [
    'slider',
    `slider-${size}`,
    size === 'lg' && costsYou > 0 && kx == null ? 'is-costly' : '',
    kx != null ? 'has-line' : '',
    costsATier ? 'is-tier-crossed' : '',
    disabled ? 'is-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const range = (
    <input
      type="range"
      id={id}
      className="slider-input"
      min={0}
      max={MAX}
      step={0.5}
      value={value}
      disabled={disabled}
      aria-valuetext={valueText}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        e.currentTarget.dataset.pointer = 'true';
      }}
      onBlur={(e) => {
        delete e.currentTarget.dataset.pointer;
      }}
    />
  );

  const bubble = editing ? (
    <>
      <label className="sr-only" htmlFor={editId}>
        {label}, percent
      </label>
      <input
        id={editId}
        className="bubble bubble-input"
        type="text"
        inputMode="decimal"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            setEditing(false);
          }
        }}
      />
    </>
  ) : (
    <button type="button" className="bubble" onClick={startEdit} disabled={disabled}>
      {shown}
      <span className="sr-only"> off, type a value</span>
    </button>
  );

  if (size === 'sm') {
    return (
      <div className={cls} style={style}>
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
        <div className="slider-body">
          {bubble}
          <span className="slider-track">
            <span className="slider-fill" />
          </span>
          {range}
        </div>
      </div>
    );
  }

  // Scale labels that would collide with the line's own value chip step aside.
  const clearOfLine = (v: number) => kx == null || Math.abs(v - kx) > 7;

  return (
    <div className={cls} style={style}>
      <div className="slider-head">
        <label className="slider-label" htmlFor={id}>
          <span className="sq sq-costs" aria-hidden="true" />
          {label}
        </label>
        {aside}
      </div>
      <div className="slider-body">
        {bubble}
        {kx != null && (
          <>
            <span className="slider-flank is-kept" aria-hidden="true">
              <i />
              <span>
                <span className="slider-flank-long">Bonus </span>kept
              </span>
            </span>
            <span className="slider-flank is-lost" aria-hidden="true">
              <i />
              <span>
                <span className="slider-flank-long">Bonus </span>lost
              </span>
            </span>
          </>
        )}
        <span className="slider-track">
          {kx != null && <span className="slider-zone" />}
          <span className="slider-fill" />
        </span>
        {kx != null && <span className="slider-line" aria-hidden="true" />}
        {value === 0 && !disabled && <span className="nudge-ring slider-idle-ring" aria-hidden="true" />}
        {pulse > 0 && (
          <span key={pulse} className="slider-tier-ring" aria-hidden="true" onAnimationEnd={() => setPulse(0)} />
        )}
        {range}
        <div className="slider-scale" aria-hidden="true">
          {MINOR.map((v) => (
            <span key={v} className={`slider-tick${v % 25 === 0 ? ' is-major' : ''}`} style={{ '--v': String(v) } as CSSProperties} />
          ))}
          {MAJOR.filter(clearOfLine).map((v) => (
            <span key={v} className="slider-tick-label" style={{ '--v': String(v) } as CSSProperties}>
              {v}%
            </span>
          ))}
          {kx != null && <span className="slider-line-chip">{fmtPctShort(kx)}</span>}
        </div>
      </div>
      <div className="slider-foot">
        {caption && <p className="slider-caption">{caption}</p>}
        {value > 0 && !disabled && (
          <button type="button" className="btn-text slider-prompt" onClick={() => animateTo(0)}>
            Hold the line. Try 0% &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
