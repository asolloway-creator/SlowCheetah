import { currentUser, getCompPlan } from '@/lib/queries';
import { saveOpeningAction, savePlanAction } from '../actions';
import { Shell } from '../AccountViews';
import { DemoPlan } from '../demo/DemoViews';
import PlanCapture from '@/components/capture/PlanCapture';
import ImportDemoPlan from '@/components/ImportDemoPlan';

export const metadata = { title: 'Your plan · IOI' };

export default async function PlanPage() {
  const { user } = await currentUser();
  if (!user) return <DemoPlan />;
  const plan = await getCompPlan(user.id);
  return (
    <Shell current="/plan" email={user.email ?? ''} width="plan">
      {!plan && <ImportDemoPlan />}
      <PlanCapture current={plan} onSave={savePlanAction} onOpening={saveOpeningAction} account />
    </Shell>
  );
}
