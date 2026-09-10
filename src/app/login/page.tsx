import { Shell } from '../AccountViews';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in — IOI' };

export default function LoginPage() {
  return (
    <Shell current="/login" email={null} width="auth">
      <LoginForm />
    </Shell>
  );
}
