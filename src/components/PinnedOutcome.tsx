'use client';

import { useEffect, useState } from 'react';
import type { Tone } from '@/components/opening';

/**
 * Mobile only (CSS hides it from 900px up): a compact bar pinned to the
 * bottom of the stage whenever the outcome figure has scrolled out of view,
 * so the number and the slider are on screen together. Tapping it brings the
 * figure back.
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
      ([e]) => setAbove(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 },
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
      </button>
    </div>
  );
}
