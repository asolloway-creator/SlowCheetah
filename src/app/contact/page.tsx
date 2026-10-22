import { currentUser } from '@/lib/queries';
import { Shell } from '../AccountViews';
import ContactForm from './ContactForm';

export const metadata = {
  title: 'Contact · IOI',
  description: 'Questions, feedback or a plan IOI got wrong: send a note.',
};

export default async function ContactPage() {
  const { user } = await currentUser();
  return (
    <Shell current="/contact" email={user?.email ?? null} width="plan">
      <h1 className="page-title">Contact us</h1>
      <p className="plan-intro">Questions, feedback, or a plan IOI didn&rsquo;t read right. Send a short note and we&rsquo;ll get back to you by email.</p>
      <ContactForm email={user?.email ?? ''} />
    </Shell>
  );
}
