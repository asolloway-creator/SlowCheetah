'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtD } from '@/lib/format';

/**
 * Eases a currency figure from its previous value to the new one, the way the
 * prototype's hero numbers did. Respects prefers-reduced-motion.
 */
export default function TweenedMoney({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const start = from.current;
    from.current = value;

    if (reduced || start === value) {
      setShown(value);
      return;
    }

    const t0 = performance.now();
    const dur = 240;

    const step = (ts: number) => {
      const p = Math.min(1, (ts - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value]);

  return <span className={className}>{fmtD(shown)}</span>;
}
