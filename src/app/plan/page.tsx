import { currentUser, getCompPlan } from '@/lib/queries';
import { savePlanAction } from '../actions';
import { Shell } from '../AccountViews';
import { DemoPlan } from '../demo/DemoViews';
import PlanSentence from '@/components/PlanSentence';

export const metadata = { title: 'Your plan — IOI' };

export default async function PlanPage() {
  const { user } = await currentUser();
  if (!user) return <DemoPlan />;
  const plan = await getCompPlan(user.id);
  return (
    <Shell current="/plan" email={user.email ?? ''} width="plan">
      <PlanSentence plan={plan} demo={false} onSave={savePlanAction} />
    </Shell>
  );
}
