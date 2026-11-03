'use client';

import Link, { useLinkStatus } from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import AccountMenu from '@/components/AccountMenu';
import { MarkRing } from '@/components/Wordmark';
import { Icon, type IconName } from '@/components/app/icons';
import { NAV_COOKIE } from '@/components/app/nav';

export type View = 'home' | 'deals' | 'forecast' | 'pipeline' | 'closed' | 'discounts' | 'plan';

/** The signed-in views, in the order the sidebar lists them. */
export const VIEWS: { key: Exclude<View, 'plan'>; label: string; title: string; icon: IconName; path: string }[] = [
  { key: 'home', label: 'Home', title: 'Home', icon: 'home', path: '/' },
  { key: 'deals', label: 'Deal Desk', title: 'Deal Desk', icon: 'deal', path: '/deals' },
  { key: 'forecast', label: 'Forecast', title: 'Forecast', icon: 'forecast', path: '/forecast' },
  { key: 'pipeline', label: 'Pipeline', title: 'Pipeline', icon: 'pipeline', path: '/pipeline' },
  { key: 'closed', label: 'Closed Won', title: 'Closed Won', icon: 'closed', path: '/closed' },
  { key: 'discounts', label: 'Discounts', title: 'Discounts', icon: 'discounts', path: '/discounts' },
];

/**
 * The signed-in frame: a sidebar of views, collapsed to icons by default
 * (it opens over the page on hover or focus, and can be pinned open), a top
 * bar with the view's name, the ARR | MRR switch and New deal, and the view
 * itself. On a phone the sidebar is a drawer behind a menu button.
 * `href` turns a view into a link (fixtures point it at themselves).
 */
export default function AppShell({
  view,
  email,
  unit,
  onUnit,
  href = (v) => (v === 'plan' ? '/plan' : VIEWS.find((x) => x.key === v)!.path),
  title,
  pinned: pinnedAtLoad = false,
  children,
}: {
  view: View;
  email: string;
  /** The ARR | MRR switch, when the plan's quota is in revenue. */
  unit?: 'arr' | 'mrr';
  onUnit?: (u: 'arr' | 'mrr') => void;
  href?: (v: View) => string;
  /** Overrides the view's own name in the top bar. */
  title?: string;
  /** The sidebar pinned open (from the cookie). */
  pinned?: boolean;
  children: ReactNode;
}) {
  const [pinned, setPinned] = useState(pinnedAtLoad);
  const [drawer, setDrawer] = useState(false);
  const router = useRouter();
  // A fresh deal on the deal desk, every time (the stamp makes a repeat click
  // a new address, so the desk starts over even when it's already open).
  function newDeal() {
    const d = href('deals');
    router.push(`${d}${d.includes('?') ? '&' : '?'}new=${Date.now()}`);
  }

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  function pin() {
    const next = !pinned;
    setPinned(next);
    document.cookie = `${NAV_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
  }

  const unitSwitch = (cls: string) =>
    onUnit && unit ? (
      <span className={`ov-unit ${cls}`} role="group" aria-label="Show revenue as">
        <button type="button" aria-pressed={unit === 'arr'} onClick={() => onUnit('arr')}>
          ARR
        </button>
        <button type="button" aria-pressed={unit === 'mrr'} onClick={() => onUnit('mrr')}>
          MRR
        </button>
      </span>
    ) : null;
  const heading = title ?? (view === 'plan' ? 'Your plan' : VIEWS.find((v) => v.key === view)!.title);
  const go = () => setDrawer(false);

  return (
    <div className={`as${pinned ? ' is-pinned' : ''}${drawer ? ' is-drawer' : ''}`}>
      <nav className="as-nav" aria-label="IOI">
        <div className="as-brand">
          <Link href={href('home')} className="as-logo" aria-label="IOI home" onClick={go}>
            <span className="as-logo-mark" aria-hidden="true">
              I<MarkRing className="as-ring" />I
            </span>
          </Link>
          <button type="button" className="as-pin" onClick={pin} aria-pressed={pinned} aria-label={pinned ? 'Collapse the menu' : 'Keep the menu open'}>
            <Icon name={pinned ? 'collapse' : 'expand'} />
          </button>
          <button type="button" className="as-close" onClick={go} aria-label="Close the menu">
            <Icon name="close" />
          </button>
        </div>

        <ul className="as-list">
          {VIEWS.map((v) => (
            <li key={v.key}>
              <Link href={href(v.key)} className="as-item" aria-current={view === v.key ? 'page' : undefined} onClick={go}>
                <Icon name={v.icon} />
                <span className="as-label">{v.label}</span>
                <Pending />
              </Link>
            </li>
          ))}
        </ul>

        <div className="as-foot">
          {/* On a phone the top bar has no room for it. */}
          {unitSwitch('as-unit-nav')}
          <Link href={href('plan')} className="as-item" aria-current={view === 'plan' ? 'page' : undefined} onClick={go}>
            <Icon name="plan" />
            <span className="as-label">Your plan</span>
          </Link>
          <nav className="as-legal" aria-label="About IOI">
            <Link href="/plans-and-privacy">How IOI handles your plan</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </nav>
      <button type="button" className="as-scrim" aria-label="Close the menu" tabIndex={drawer ? 0 : -1} onClick={go} />

      <div className="as-body">
        <header className="as-top">
          <button type="button" className="as-menu" onClick={() => setDrawer(true)} aria-label="Open the menu" aria-expanded={drawer}>
            <Icon name="menu" />
          </button>
          <h1 className="as-title">{heading}</h1>
          <div className="as-top-acts">
            {unitSwitch('as-unit-top')}
            <button type="button" className="btn btn-primary as-new" onClick={newDeal} aria-label="New deal">
              <span aria-hidden="true">+</span>
              <span className="as-new-label">New deal</span>
            </button>
            {email ? <AccountMenu email={email} current={view === 'plan' ? '/plan' : '/'} /> : <span className="as-skel-dot" aria-hidden="true" />}
          </div>
        </header>
        <main className="app as-main">{children}</main>
      </div>
    </div>
  );
}

/** A link on its way: a thin bar along the item until the view arrives
 *  (Home has no loading screen of its own, since it's also the landing page). */
function Pending() {
  const { pending } = useLinkStatus();
  return <span className={`as-pending${pending ? ' is-on' : ''}`} aria-hidden="true" />;
}
