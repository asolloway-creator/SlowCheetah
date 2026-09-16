'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Wordmark from '@/components/Wordmark';

// Applies to every route under app/ that doesn't have a more specific
// error.tsx of its own. Before this, a failed Supabase fetch on any
// signed-in page (getCompPlan, listDeals, ...) fell through to Next's
// generic unstyled error page — a dead end with no way back except the
// browser's own back button.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="state-page">
      <Wordmark />
      <div className="state-page-body">
        <h1 className="page-title">Something went wrong</h1>
        <p className="auth-copy">
          That didn&rsquo;t load &mdash; a connection hiccup, not lost data. Try again, or head back to your deal.
        </p>
        <div className="state-page-actions">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link className="btn-text" href="/">
            Back to your deal &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
