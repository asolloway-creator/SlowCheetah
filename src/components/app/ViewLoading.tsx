import { cookies } from 'next/headers';
import AppShell, { type View } from '@/components/app/AppShell';
import { NAV_COOKIE } from '@/components/app/nav';

/**
 * What a view shows while its numbers load: the frame, already on the right
 * view, and the shape of the page in quiet blocks, so moving between views
 * answers at once instead of waiting on a blank click.
 */
export default async function ViewLoading({ view }: { view: View }) {
  const pinned = (await cookies()).get(NAV_COOKIE)?.value === '1';
  const blocks = view === 'deals' ? 3 : view === 'home' ? 3 : 2;
  return (
    <AppShell view={view} email="" pinned={pinned}>
      <div className={`as-view as-skel is-${view}`} role="status" aria-label="Loading">
        {Array.from({ length: blocks }, (_, i) => (
          <span key={i} className="as-skel-block" />
        ))}
      </div>
    </AppShell>
  );
}
