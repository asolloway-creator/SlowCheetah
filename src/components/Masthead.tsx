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
 * "Put your plan in" doesn't get header real estate on `/` — DealStage
 * already renders that same CTA as the plan-bridge card there, so the
 * header link would be a duplicate. Elsewhere `/?plan=1` opens the same
 * inline dialog DealStage renders on `/`.
 *
 * "Sign in" is different: it's not a CTA earning its moment, it's a door
 * back in for someone who already has an account and just wants their own
 * plan and deals again — a first-time visitor never needs it, but there's
 * no page where a *returning* one can be assumed not to. So unlike "Put
 * your plan in" it's unconditional, quiet, and present on every page
 * including `/` — but WHERE it lives depends on what else is in the auth
 * slot. On `/`, auth has nothing else in it, so "Sign in" sits there alone
 * (auth-link, the same weight "Sign out" gets once signed in). Elsewhere,
 * auth already holds the bolder "Put your plan in" button, and at phone
 * widths that slot has no room left for a second item without overflowing
 * or overlapping the wordmark (found live, see git history) — so there
 * "Sign in" moves into the nav row instead, next to the back-link, which
 * already has the width to spare.
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
              <Link href="/login">Sign in</Link>
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
          ) : current === '/' ? (
            <Link href="/login" className="auth-link">
              Sign in
            </Link>
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
