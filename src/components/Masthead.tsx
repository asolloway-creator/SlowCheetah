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
 * as tabs to go explore.
 *
 * Sign-in doesn't get header real estate either — nothing here requires an
 * account, it's a "keep this across devices" upsell, and it already has an
 * earned moment (after booking a deal, after putting a plan in). The one
 * thing every visitor should do gets the header instead: put your plan in.
 * `/?plan=1` opens the same inline dialog DealStage renders on `/`, from
 * any page.
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
            <Link href="/?plan=1" className="btn btn-primary">
              Put your plan in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
