'use client';

import { useEffect } from 'react';

/**
 * Renders nothing — just keeps a `tz` cookie current with the visitor's own
 * IANA timezone, so server components/actions can compute period
 * boundaries against the rep's calendar instead of Vercel's UTC (see
 * startOfPeriodInZone in calc.ts). Can't help the very first request of a
 * session (the cookie isn't set until after that page has already
 * rendered) — queries.ts falls back to UTC then, same as before this
 * existed. Every request after is correct.
 */
export default function SetTimeZoneCookie() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && document.cookie.split('; ').find((c) => c.startsWith('tz='))?.split('=')[1] !== tz) {
        document.cookie = `tz=${tz}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // Intl.DateTimeFormat/timeZone resolution failing at all is not a
      // real-world case worth its own UI — the UTC fallback covers it.
    }
  }, []);
  return null;
}
