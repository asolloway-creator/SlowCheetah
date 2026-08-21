import Link from 'next/link';

export const metadata = { title: 'Sign-in problem — IOI' };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="monogram">[me]</div>
        </div>
        <div className="card">
          <div className="auth-title">That link didn&rsquo;t work</div>
          <div className="notice err" style={{ marginTop: 14 }}>
            {message ?? 'The sign-in link is invalid or has expired.'}
          </div>
          <div className="auth-sub">
            Sign-in links are single-use and expire. Request a fresh one and open it in
            the same browser you asked for it from.
          </div>
          <Link href="/login">
            <button className="btn btn-primary btn-lg">Back to sign in</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
