import Link from 'next/link';
import Wordmark from '@/components/Wordmark';

const NAV = [
  { href: '/', label: 'New deal' },
  { href: '/quota', label: 'Quota' },
  { href: '/history', label: 'Deals' },
  { href: '/plan', label: 'Your plan' },
];

/**
 * A floating pill. Signed in: the four app pages plus sign out. Signed out:
 * "Sign in" and "Put your plan in" everywhere, plus one contextual link,
 * "How it works" on `/` or a way back to the deal from any other page
 * (the deal page links visitors onward to /quota and /history, which have
 * no nav of their own). "Put your plan in" links to `/?plan=1`, which opens
 * the inline plan dialog DealStage renders, from any page.
 *
 * Signed out with a plan of their own already in this browser (`own`), the
 * ask is no longer "put your plan in" but "keep it": their plan, and sign in.
 */
export default function Masthead({ current, email, own = false }: { current: string; email: string | null; own?: boolean }) {
  return (
    <header className="masthead">
      <div className={`masthead-bar${email ? ' is-signed-in' : ''}`}>
        <Wordmark />
        {email ? (
          <>
            <nav className="nav" aria-label="Primary">
              {NAV.map((t) => (
                <Link key={t.href} href={t.href} aria-current={t.href === current ? 'page' : undefined}>
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="auth">
              <span className="auth-email">{email}</span>
              <form action="/auth/signout" method="post">
                <button type="submit" className="nav-link">
                  Sign out
                </button>
              </form>
            </div>
          </>
        ) : own ? (
          <div className="auth">
            {current !== '/' && (
              <Link className="nav-link hide-sm" href="/">
                &larr; Back to your deal
              </Link>
            )}
            {current !== '/plan' && (
              <Link className="nav-link" href="/plan">
                Your plan
              </Link>
            )}
            <Link className="btn btn-primary" href="/login" aria-current={current === '/login' ? 'page' : undefined}>
              Sign in
            </Link>
          </div>
        ) : (
          <div className="auth">
            {current === '/' ? (
              <a className="nav-link hide-sm" href="#how">
                How it works
              </a>
            ) : (
              <Link className="nav-link hide-sm" href="/">
                &larr; Back to your deal
              </Link>
            )}
            <Link className="nav-link" href="/login" aria-current={current === '/login' ? 'page' : undefined}>
              Sign in
            </Link>
            {/* Already on the page where you put your plan in. */}
            {current !== '/plan' && (
              <Link className="btn btn-primary" href="/?plan=1" scroll={false}>
                Put your plan in
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
