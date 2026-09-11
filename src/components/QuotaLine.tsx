'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CalcResult, CompPlan, PeriodToDate } from '@/lib/calc';
import { periodNoun } from '@/lib/format';
import { dealLine, quarterLine, type LineModel } from '@/components/opening';

type Props =
  | { mode: 'deal'; plan: CompPlan; ptd: PeriodToDate; r: CalcResult }
  | { mode: 'quarter'; plan: CompPlan; ptd: PeriodToDate };

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
const vars = (o: Record<string, string>) => o as CSSProperties;

/**
 * The number line — post, bar, ghost, ring, post. Plain HTML, absolutely
 * positioned children driven by CSS custom properties; the only inline styles
 * on the site are these geometry values.
 */
export default function QuotaLine(props: Props) {
  const m: LineModel = props.mode === 'deal' ? dealLine(props.plan, props.ptd, props.r) : quarterLine(props.plan, props.ptd);
  const markX = m.ringX ?? m.quotaX ?? 1;
  const align: 'left' | 'centre' | 'right' = markX > 0.6 ? 'right' : markX < 0.12 ? 'left' : 'centre';

  // The ring pulses once when the deal crosses, and on load when the quarter
  // is already accelerated. Re-keying the ring replays the keyframe.
  const [pulse, setPulse] = useState(props.mode === 'quarter' && m.crossed ? 1 : 0);
  const wasCrossed = useRef(m.crossed);
  useEffect(() => {
    if (m.crossed && !wasCrossed.current) setPulse((k) => k + 1);
    wasCrossed.current = m.crossed;
  }, [m.crossed]);

  // Keep the status callout clear of the origin label when a big deal pulls
  // the ring far left. Measured after paint; the opening state needs no shift.
  const figRef = useRef<HTMLElement>(null);
  const originRef = useRef<HTMLSpanElement>(null);
  const calloutRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState<number | null>(null);
  const calloutText = m.callout?.text ?? '';
  useEffect(() => {
    const fig = figRef.current;
    if (!fig) return;
    const measure = () => {
      const o = originRef.current;
      const c = calloutRef.current;
      const W = fig.clientWidth;
      if (!o || !c || !W) {
        setShift(null);
        return;
      }
      const originRight = o.offsetLeft + o.offsetWidth + 12;
      const cw = c.offsetWidth;
      const x = markX * W;
      const left = align === 'right' ? x + 7 - cw : align === 'left' ? x : x - cw / 2;
      setShift(left < originRight && originRight + cw <= W ? originRight : null);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(fig);
    return () => ro?.disconnect();
  }, [markX, align, calloutText]);

  const cls = ['line', m.accelerated ? 'is-accelerated' : '', m.crossed ? 'is-crossed' : ''].filter(Boolean).join(' ');

  return (
    <figure
      ref={figRef}
      className={cls}
      aria-label={props.mode === 'deal' ? `Where this deal lands on your ${periodNoun(props.plan)}` : 'Where you stand this period'}
    >
      <div className="line-top">
        <span className={`line-marker is-${align}`} style={vars({ '--x': pct(markX) })}>
          {m.marker}
        </span>
      </div>
      <div className="line-mid">
        <span className="line-track" />
        <span className="line-post" />
        <span className="line-bar" style={vars({ '--w': pct(m.barW) })} />
        <span className="line-ghost" style={vars({ '--x': pct(m.ghostX), '--w': pct(m.ghostW) })} />
        {m.quotaX !== null && <span className="line-post line-post-quota" style={vars({ '--x': pct(m.quotaX) })} />}
        {m.ringX !== null && (
          <span key={pulse} className={`line-ring${pulse > 0 ? ' is-pulsing' : ''}`} style={vars({ '--x': pct(m.ringX) })} />
        )}
      </div>
      <div className="line-bottom">
        <span ref={originRef} className="line-origin">
          {m.origin}
        </span>
        {m.callout && (
          <span
            key={m.callout.tone}
            ref={calloutRef}
            className={`line-callout fade-up is-${m.callout.tone} ${shift !== null ? 'is-shifted' : `is-${align}`}`}
            style={shift !== null ? vars({ '--x': pct(markX), '--cx': `${shift}px` }) : vars({ '--x': pct(markX) })}
          >
            {m.callout.text}
          </span>
        )}
        {m.quotaLabel && m.quotaX !== null && (
          <span className={`line-quota-label is-${m.quotaX > 0.6 ? 'right' : 'centre'}`} style={vars({ '--x': pct(m.quotaX) })}>
            {m.quotaLabel}
          </span>
        )}
      </div>
    </figure>
  );
}
