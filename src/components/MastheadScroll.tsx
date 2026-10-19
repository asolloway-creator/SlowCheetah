'use client';

import { useEffect } from 'react';

/**
 * The floating header tucks away while you scroll down the page and comes
 * back the moment you scroll up, so it never sits over what you're reading.
 * Never hidden near the top, or while something in it has focus.
 */
export default function MastheadScroll() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.masthead');
    if (!el) return;
    let last = window.scrollY;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const down = y > last + 4;
      const up = y < last - 4;
      if (y < 120 || up || el.contains(document.activeElement)) el.classList.remove('is-tucked');
      else if (down) el.classList.add('is-tucked');
      if (down || up) last = y;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return null;
}
