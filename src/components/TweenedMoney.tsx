'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtMoney } from '@/lib/format';

/**
 * Eases a currency figure from its previous value to the new one — 400ms,
 * cubic-out (the same curve as --ease-out), snapping under
 * prefers-reduced-motion. Set in a face with tabular figures, so the width
 * holds while digits change and only shifts when the digit count does.
 */
export default function TweenedMoney({
  value,
  className,
  format = fmtMoney,
  signed = false,
  duration = 400,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
  signed?: boolean;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const start = from.current;
    from.current = value;

    if (reduced || start === value) {
      setShown(value);
      return;
    }

    // Whole-dollar figures count in whole dollars so cents never flicker in.
    const whole = Number.isInteger(Math.round(start * 100) / 100) && Number.isInteger(Math.round(value * 100) / 100);
    const t0 = performance.now();

    const step = (ts: number) => {
      const p = Math.min(1, (ts - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (value - start) * eased;
      setShown(p >= 1 ? value : whole ? Math.round(v) : v);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  const text = signed ? `${shown > 0 ? '+' : shown < 0 ? '−' : ''}${format(Math.abs(shown))}` : format(shown);
  return <span className={className}>{text}</span>;
}
