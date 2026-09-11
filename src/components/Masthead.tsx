import Link from 'next/link';
import Wordmark from '@/components/Wordmark';

const NAV = [
  { href: '/', label: 'New deal' },
  { href: '/quota', label: 'Quota' },
  { href: '/history', label: 'Deals' },
  { href: '/plan', label: 'Your plan' },
];

/**
 * Nav is signed-in only. A first-time visitor has nothing to hunt through —
 * everything they need has to be on the page they land on. `/plan`, `/quota`
 * and `/history` still work if reached directly; they're just not advertised
 * as tabs to go explore. Branches on the same truthy check as the auth
 * widget below it, so the two halves of the header never disagree about
 * whether someone's signed in.
 */
export default function Masthead({ current, email }: { current: string; email: string | null }) {
  return (
    <header className="masthead">
      <div className={`container masthead-inner${email ? '' : ' is-minimal'}`}>
        <Wordmark />
        {email && (
          <nav className="nav" aria-label="Primary">
            {NAV.map((t) => (
              <Link key={t.href} href={t.href} aria-current={t.href === current ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
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
            <Link href="/login" className="auth-link">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
