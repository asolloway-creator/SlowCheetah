import Link from 'next/link';
import NavLink from '@/components/NavLink';
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
 * Signed out with a plan of their own already in this browser (`own`), they
 * get the same four pages a signed-in rep does, and the ask is no longer
 * "put your plan in" but "keep it": sign in. The server can't tell those
 * visitors apart, so until the store loads (`pending`) their links stay
 * hidden rather than offering them a plan they've already put in.
 */
export default function Masthead({
  current,
  email,
  own = false,
  pending = false,
}: {
  current: string;
  email: string | null;
  own?: boolean;
  /** Before the browser store loads: see Shell. */
  pending?: boolean;
}) {
  return (
    <header className="masthead">
      <div className={`masthead-bar${email || own ? ' is-signed-in' : ''}${pending ? ' is-pending' : ''}`}>
        <Wordmark />
        {email ? (
          <>
            <nav className="nav" aria-label="Primary">
              {NAV.map((t) => (
                <NavLink key={t.href} href={t.href} aria-current={t.href === current ? 'page' : undefined}>
                  {t.label}
                </NavLink>
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
          <>
            <nav className="nav" aria-label="Primary">
              {NAV.map((t) => (
                <NavLink key={t.href} href={t.href} aria-current={t.href === current ? 'page' : undefined}>
                  {t.label}
                </NavLink>
              ))}
            </nav>
            <div className="auth">
              <Link className="btn btn-primary" href="/login" aria-current={current === '/login' ? 'page' : undefined}>
                Sign in
              </Link>
            </div>
          </>
        ) : (
          <div className="auth">
            {current === '/' ? (
              <a className="nav-link hide-sm" href="#how">
                How it works
              </a>
            ) : (
              <NavLink className="nav-link hide-sm" href="/">
                &larr; Back to your deal
              </NavLink>
            )}
            <NavLink className="nav-link" href="/login" aria-current={current === '/login' ? 'page' : undefined}>
              Sign in
            </NavLink>
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
