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
 * "How it works" (on the home page) or a way home, "Sign in" for an account
 * you have, and "Put your plan in", which creates one (/signup). A plan lives
 * in an account; nothing is kept in the browser.
 */
export default function Masthead({ current, email }: { current: string; email: string | null }) {
  return (
    <header className="masthead">
      <div className={`masthead-bar${email ? ' is-signed-in' : ''}`}>
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
        ) : (
          <div className="auth">
            {current === '/' ? (
              <a className="nav-link hide-sm" href="#how">
                How it works
              </a>
            ) : (
              <NavLink className="nav-link hide-sm" href="/">
                &larr; Home
              </NavLink>
            )}
            <NavLink className="nav-link" href="/login" aria-current={current === '/login' ? 'page' : undefined}>
              Sign in
            </NavLink>
            {current !== '/signup' && (
              <Link className="btn btn-primary" href="/signup">
                Put your plan in
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
