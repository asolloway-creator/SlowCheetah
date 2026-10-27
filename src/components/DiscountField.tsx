'use client';

import type { ReactNode } from 'react';
import NumField from '@/components/NumField';

export type DiscountMode = 'pct' | 'price';

/**
 * A line's discount, typed either way a quote shows it: as a percent off, or
 * as the price actually being quoted (the quote shows the net price, not the
 * percent). A small % / $ switch inside the field picks which. In price mode
 * the percent is worked out from the line's list amount, so everything
 * downstream still runs on the percent.
 */
export default function DiscountField({
  id,
  list,
  pct,
  onPct,
  mode,
  onMode,
  target,
}: {
  id: string;
  /** The line's list amount, in the same unit as the amount beside it. */
  list: number;
  pct: number;
  onPct: (n: number) => void;
  mode: DiscountMode;
  onMode: (m: DiscountMode) => void;
  /** The rep's target, shown beside the label. */
  target?: ReactNode;
}) {
  const net = Math.round(list * (1 - pct / 100) * 100) / 100;
  const adorn = (
    <span className="disc-mode" role="group" aria-label="Type the discount as">
      <button type="button" aria-pressed={mode === 'pct'} aria-label="A percent off" onClick={() => onMode('pct')}>
        %
      </button>
      <button type="button" aria-pressed={mode === 'price'} aria-label="The price quoted" onClick={() => onMode('price')}>
        $
      </button>
    </span>
  );
  const head = target ?? <span aria-hidden="true" />;
  return mode === 'pct' ? (
    <NumField id={id} label="Discount" max={100} value={pct} onChange={onPct} head={head} adorn={adorn} />
  ) : (
    <NumField
      id={id}
      label="Price quoted"
      prefix="$"
      value={net}
      disabled={list <= 0}
      // Unrounded, so the price typed is the price kept (a rounded percent
      // would move it by a few cents while typing).
      onChange={(n) => onPct(list > 0 ? Math.min(100, Math.max(0, (1 - n / list) * 100)) : 0)}
      head={head}
      adorn={adorn}
    />
  );
}
