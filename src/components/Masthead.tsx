import Link from 'next/link';

const TABS = [
  { href: '/', label: 'Deal' },
  { href: '/history', label: 'History' },
  { href: '/quota', label: 'Quota' },
  { href: '/plan', label: 'Comp plan' },
];

export default function Masthead({ current, email }: { current: string; email: string | null }) {
  return (
    <div className="masthead">
      <Link href="/" className="brand">
        <div className="monogram">IOI</div>
        <div className="brand-text">
          <div className="brand-name">IOI</div>
          <div className="brand-tag">Information over incentive</div>
        </div>
      </Link>
      <div className="masthead-right">
        <nav className="nav">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={t.href === current ? 'on' : ''}>
              {t.label}
            </Link>
          ))}
        </nav>
        {email ? (
          <>
            <span className="who">{email}</span>
            <form action="/auth/signout" method="post">
              <button className="btn btn-quiet" type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <>
            <span className="demo-chip">Demo · saved in this browser only</span>
            <Link href="/login" className="btn btn-primary">Sign in to keep it</Link>
          </>
        )}
      </div>
    </div>
  );
}
