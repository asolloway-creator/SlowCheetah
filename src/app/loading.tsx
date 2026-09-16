import Wordmark from '@/components/Wordmark';

// Applies to every route under app/ that doesn't have a more specific
// loading.tsx of its own — every signed-in page here is a Server Component
// that blocks on a Supabase fetch before rendering anything, and until now
// a slow connection meant a stalled navigation with zero feedback instead
// of this.
export default function Loading() {
  return (
    <div className="state-page" role="status" aria-live="polite">
      <Wordmark />
      <p className="state-page-text">Loading&hellip;</p>
    </div>
  );
}
