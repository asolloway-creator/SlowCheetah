import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import LoginForm from './LoginForm';
import { safeNext } from '@/lib/safe-next';

export const metadata = { title: 'Sign in · IOI' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = (await searchParams).next;
  const next = safeNext(Array.isArray(q) ? q[0] : q);
  const { user } = await currentUser();
  if (user) redirect(next);
  return (
    <Shell current="/login" email={null} width="auth">
      <LoginForm mode="signin" next={next} />
    </Shell>
  );
}
