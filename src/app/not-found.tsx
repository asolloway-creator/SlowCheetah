import Link from 'next/link';
import { currentUser } from '@/lib/queries';
import { Shell } from './AccountViews';

/**
 * Every URL nothing else handles, and any notFound(). Inside the normal page
 * shell, signed in or not, instead of the framework's bare white page with no
 * way back.
 */
export default async function NotFound() {
  let email: string | null = null;
  try {
    const { user } = await currentUser();
    email = user?.email ?? null;
  } catch {}

  return (
    <Shell current="" email={email} width="auth">
      <title>Page not found · IOI</title>
      <div className="auth-page">
        <h1 className="page-title">Nothing here.</h1>
        <p className="auth-copy">This page doesn&rsquo;t exist, or it&rsquo;s moved.</p>
        <div className="auth-actions">
          <Link href="/" className="btn btn-primary btn-block">
            Back to IOI
          </Link>
        </div>
      </div>
    </Shell>
  );
}
