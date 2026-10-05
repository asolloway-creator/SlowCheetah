import { redirect } from 'next/navigation';
import { currentUser, getCompPlan } from '@/lib/queries';
import { saveOpeningAction, savePlanAction } from '../actions';
import { Shell } from '../AccountViews';
import PlanCapture from '@/components/capture/PlanCapture';

export const metadata = { title: 'Your plan · IOI' };

export default async function PlanPage() {
  const { user } = await currentUser();
  if (!user) redirect('/signup');
  const plan = await getCompPlan(user.id);
  return (
    <Shell current="/plan" email={user.email ?? ''} width="plan">
      <PlanCapture current={plan} onSave={savePlanAction} onOpening={saveOpeningAction} account />
    </Shell>
  );
}
