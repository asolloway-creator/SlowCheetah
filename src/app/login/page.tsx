import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in — IOI' };

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="monogram">IOI</div>
          <div>
            <div className="brand-name" style={{ fontSize: 19, fontWeight: 700 }}>
              IOI
            </div>
            <div className="brand-tag" style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 3 }}>
              Information over incentive
            </div>
          </div>
        </div>

        <div className="card">
          <div className="auth-title">Sign in</div>
          <div className="auth-sub">
            Keep your plan and your deals across devices. Enter your email and we&rsquo;ll
            send a sign-in link — no password to manage.
          </div>
          <LoginForm />
        </div>

        <div className="privacy-note">
          Your comp plan and your deals are yours alone. They are stored under your
          account, visible only to you, and nobody who runs this app can read them
          through it.
        </div>
      </div>
    </div>
  );
}
