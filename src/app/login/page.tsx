import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in · IOI' };

export default async function LoginPage() {
  const { user } = await currentUser();
  if (user) redirect('/');
  return (
    <Shell current="/login" email={null} width="auth">
      <LoginForm mode="signin" />
    </Shell>
  );
}
