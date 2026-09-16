'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { fmtPctShort } from '@/lib/format';

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A native range with a filled track, a click-to-type value bubble and a
 * "try 0%" tween. Keyboard: ←/→ 0.5, Shift 5, Home/End 0/max.
 * `size="lg"` is the promoted control under the outcome figure;
 * `size="sm"` is the compact one under the one-time products field.
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
  disabled = false,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  size?: 'lg' | 'sm';
  /** Dollars this discount costs the rep — fills the track red when > 0. */
  costsYou?: number;
  valueText: string;
  caption?: string;
  disabled?: boolean;
}) {
  // Fixed 0–100 scale — the track's max never moves, so a given thumb
  // position always means the same percentage. It used to rescale in steps
  // of 25 based on the current value, which meant "all the way right" could
  // silently mean 25% one moment and 100% the next.
  const MAX = 100;
  const pctOfTrack = value;
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

  /** Tween the value to a target over 480ms; everything downstream animates
   *  from it. Shared by both directions — holding the line back to 0%, and
   *  the first nudge away from it — so dragging is never the only way in. */
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
  const tryZero = () => animateTo(0);
  const tryDiscount = () => animateTo(10);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    delete e.currentTarget.dataset.pointer;
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    onChange(Math.max(0, Math.min(MAX, round2(value + dir * (e.shiftKey ? 5 : 0.5)))));
  }

  const rowStyle = { '--pct': String(pctOfTrack) } as CSSProperties;
  const shown = fmtPctShort(value);
  const cls = ['slider', `slider-${size}`, costsYou > 0 ? 'is-costly' : '', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ');

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

  const editor = (
    <>
      <label className="sr-only" htmlFor={editId}>
        {label}, percent
      </label>
      <input
        id={editId}
        className={size === 'lg' ? 'bubble bubble-input' : 'bubble bubble-sm bubble-input-sm'}
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
  );

  if (size === 'sm') {
    return (
      <div className={cls}>
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
        <div className="slider-row" style={rowStyle}>
          {editing ? (
            editor
          ) : (
            <button type="button" className="bubble bubble-sm" onClick={startEdit} disabled={disabled}>
              {shown}
              <span className="sr-only"> off — type a value</span>
            </button>
          )}
          <span className="slider-track" />
          <span className="slider-fill" />
          {range}
        </div>
      </div>
    );
  }

  return (
    <div className={cls}>
      <div className="slider-head">
        <label className="slider-label" htmlFor={id}>
          {label}
        </label>
        {value > 0 && !disabled && (
          <button type="button" className="btn-text slider-prompt" onClick={tryZero}>
            Hold the line — try 0% &rarr;
          </button>
        )}
        {value === 0 && !disabled && (
          <button type="button" className="btn-text slider-prompt" onClick={tryDiscount}>
            See what a discount costs — try 10% &rarr;
          </button>
        )}
      </div>
      <div className="slider-row" style={rowStyle}>
        {editing ? (
          editor
        ) : (
          <button type="button" className="bubble" onClick={startEdit} disabled={disabled}>
            {shown}
            <span className="sr-only"> off — type a value</span>
          </button>
        )}
        <span className="slider-track" />
        <span className="slider-fill" />
        {range}
      </div>
      {caption && <p className="slider-caption">{caption}</p>}
    </div>
  );
}
