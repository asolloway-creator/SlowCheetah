import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import LoginForm from '../login/LoginForm';

export const metadata = { title: 'Create your account · IOI' };

/** "Put your plan in" starts here: an account first, then the plan (/plan). */
export default async function SignupPage() {
  const { user } = await currentUser();
  if (user) redirect('/');
  return (
    <Shell current="/signup" email={null} width="auth">
      <LoginForm mode="signup" />
    </Shell>
  );
}
