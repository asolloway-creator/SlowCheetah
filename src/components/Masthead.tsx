import Link from 'next/link';
import Wordmark from '@/components/Wordmark';

const NAV = [
  { href: '/', label: 'New deal' },
  { href: '/quota', label: 'Quota' },
  { href: '/history', label: 'Deals' },
  { href: '/plan', label: 'Your plan' },
];

/**
 * Full nav is signed-in only. A first-time visitor lands on "/" with
 * nothing to hunt through. But the deal page itself now links anonymous
 * visitors onward — "See where you stand" to /quota, "See it in your
 * deals" to /history — and those pages have no nav of their own, so
 * without this they'd be a dead end: no way back to the deal except the
 * wordmark. One link back, not a full bar, keeps the "/" page exactly as
 * uncluttered as before while completing the round trip the app itself
 * now offers.
 *
 * Sign-in doesn't get header real estate either — nothing here requires an
 * account, it's a "keep this across devices" upsell, and it already has an
 * earned moment (after booking a deal, after putting a plan in). The one
 * thing every visitor should do gets the header instead: put your plan in.
 * `/?plan=1` opens the same inline dialog DealStage renders on `/`, from
 * any page.
 */
export default function Masthead({ current, email }: { current: string; email: string | null }) {
  // is-minimal collapses the grid to 2 columns (no room reserved for a nav
  // slot) — only correct when there's truly nothing in that slot. Once an
  // anonymous visitor is anywhere but "/", the back-link fills it, so this
  // needs the full 3-column layout same as signed-in.
  const minimal = !email && current === '/';
  return (
    <header className="masthead">
      <div className={`container masthead-inner${minimal ? ' is-minimal' : ''}`}>
        <Wordmark />
        {email ? (
          <nav className="nav" aria-label="Primary">
            {NAV.map((t) => (
              <Link key={t.href} href={t.href} aria-current={t.href === current ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        ) : (
          current !== '/' && (
            <nav className="nav" aria-label="Primary">
              <Link href="/">&larr; Back to your deal</Link>
            </nav>
          )
        )}
        <div className="auth">
          {email ? (
            <>
              <span className="auth-email">{email}</span>
              <form action="/auth/signout" method="post">
                <button type="submit" className="auth-link">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/?plan=1" className="btn btn-primary">
              Put your plan in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
