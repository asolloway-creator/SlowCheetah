import { redirect } from 'next/navigation';
import { currentUser, getCompPlan } from '@/lib/queries';
import { saveOpeningAction, savePlanAction, savePlanSetupAction } from '../actions';
import { Shell } from '../AccountViews';
import AppShell from '@/components/app/AppShell';
import PlanCapture from '@/components/capture/PlanCapture';

export const metadata = { title: 'Your plan · IOI' };

export default async function PlanPage() {
  const { user } = await currentUser();
  if (!user) redirect('/signup');
  const plan = await getCompPlan(user.id);
  const capture = <PlanCapture current={plan} onSave={savePlanAction} onOpening={saveOpeningAction} onSetup={savePlanSetupAction} account />;
  // Before a plan exists there's nothing for the other views to show: just
  // putting one in. After, it's one view among the rest.
  if (!plan) {
    return (
      <Shell current="/plan" email={user.email ?? ''} width="plan">
        {capture}
      </Shell>
    );
  }
  return (
    <AppShell view="plan" email={user.email ?? ''}>
      <div className="as-plan">{capture}</div>
    </AppShell>
  );
}
