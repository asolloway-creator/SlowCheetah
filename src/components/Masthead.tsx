import Link from 'next/link';

const TABS = [
  { href: '/deal', label: 'New deal' },
  { href: '/history', label: 'Deal history' },
  { href: '/dashboard', label: 'Quota' },
  { href: '/setup', label: 'Comp plan' },
];

export default function Masthead({ email, current }: { email: string; current: string }) {
  return (
    <div className="masthead">
      <div className="brand">
        <div className="monogram">IOI</div>
        <div className="brand-text">
          <div className="brand-name">IOI</div>
          <div className="brand-tag">Information over incentive</div>
        </div>
      </div>
      <div className="masthead-right">
        <nav className="nav">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={t.href === current ? 'on' : ''}>
              {t.label}
            </Link>
          ))}
        </nav>
        <span className="who">{email}</span>
        <form action="/auth/signout" method="post">
          <button className="btn btn-quiet" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
