'use client';

import { useEffect, useState } from 'react';
import type { Tone } from '@/components/opening';

/** Clear of the sticky masthead: a figure tucked under it counts as gone. */
const MASTHEAD = 88;

/**
 * A compact bar pinned to the bottom of the builder whenever the outcome
 * figure has scrolled up out of view, so the number stays on screen while
 * the fields are edited. Clicking it brings the full card back.
 */
export default function PinnedOutcome({
  targetId,
  name,
  figureText,
  tone,
  hidden,
}: {
  targetId: string;
  name: string;
  figureText: string;
  tone: Tone;
  hidden: boolean;
}) {
  const [above, setAbove] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => setAbove(!e.isIntersecting && e.boundingClientRect.top < MASTHEAD),
      { threshold: 0, rootMargin: `-${MASTHEAD}px 0px 0px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [targetId, hidden]);

  const visible = above && !hidden;

  return (
    <div className={`pinned${visible ? ' is-visible' : ''}`} aria-hidden={!visible}>
      <button
        type="button"
        className="pinned-btn"
        tabIndex={visible ? 0 : -1}
        onClick={() => {
          const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          document.getElementById(targetId)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        }}
      >
        <span className="pinned-name">{name}</span>
        <span className={`pinned-figure is-${tone}`}>{figureText}</span>
        <svg className="pinned-up" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 15V5M5 9.5 10 4.5l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
