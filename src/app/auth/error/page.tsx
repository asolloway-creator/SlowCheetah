import Link from 'next/link';
import { Shell } from '../../AccountViews';

export const metadata = { title: 'Sign-in problem — IOI' };

// Supabase's own error text ("Token has expired or is invalid", "Email
// link is invalid or has expired", etc.) is undesigned copy from a
// dependency, not something written for this app — shown verbatim it reads
// as a raw error next to everything else here that's been deliberately
// worded. The one thing worth distinguishing is expiry/reuse (the actual
// cause almost every time a link fails) from anything else; either way the
// fix is the same, so the fallback below covers it too.
function friendlyMessage(raw: string | undefined): string {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('expired') || s.includes('invalid') || s.includes('used')) {
    return 'This link has expired or was already used.';
  }
  return 'That sign-in link didn’t work.';
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <Shell current="/login" email={null} width="auth">
      <div className="auth-page">
        <h1 className="page-title">That link didn&rsquo;t work</h1>
        <p className="auth-error">{friendlyMessage(message)}</p>
        <p className="auth-copy">
          Sign-in links are single-use and expire. Request a fresh one and open it in the same browser you asked
          for it from.
        </p>
        <div className="auth-actions">
          <Link href="/login" className="btn btn-primary btn-block">
            Back to sign in
          </Link>
        </div>
      </div>
    </Shell>
  );
}
