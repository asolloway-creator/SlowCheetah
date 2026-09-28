'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { markInternal, track } from '@/lib/track';

// The last page recorded, so a re-run effect (React's dev double-invoke, a
// remount) can't count one page view twice.
let lastPath: string | null = null;

/** One 'visit' per page view: where it came from and on what. Opening /admin marks this browser as internal. */
export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/admin')) {
      markInternal();
      return;
    }
    if (pathname === lastPath) return;
    lastPath = pathname;
    const params = new URLSearchParams(window.location.search);
    let referrerHost = '';
    try {
      referrerHost = document.referrer ? new URL(document.referrer).hostname : '';
    } catch {}
    track('visit', 'site', {
      path: pathname,
      referrerHost,
      utmSource: params.get('utm_source'),
      utmMedium: params.get('utm_medium'),
      utmCampaign: params.get('utm_campaign'),
      device: window.innerWidth < 768 ? 'mobile' : 'desktop',
    });
  }, [pathname]);

  return null;
}
