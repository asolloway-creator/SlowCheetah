import Link from 'next/link';
import AccountMenu from '@/components/AccountMenu';
import MastheadScroll from '@/components/MastheadScroll';
import NavLink from '@/components/NavLink';
import Wordmark from '@/components/Wordmark';


/**
 * A floating pill that tucks away as you scroll down (MastheadScroll).
 * Signed in: everything happens on one page (the home page), so the bar is
 * just the account menu: their plan, sign out. Signed out:
 * "How it works" (on the home page) or a way home, "Sign in" for an account
 * you have, and "Put your plan in", which creates one (/signup). A plan lives
 * in an account; nothing is kept in the browser.
 */
export default function Masthead({ current, email }: { current: string; email: string | null }) {
  return (
    <header className="masthead">
      <MastheadScroll />
      <div className={`masthead-bar${email ? ' is-signed-in' : ''}`}>
        <Wordmark />
        {email ? (
          <AccountMenu email={email} current={current} />
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
