import { currentUser, getCompPlan } from '@/lib/queries';
import { savePlanAction } from '../actions';
import { AccountShell } from '../AccountViews';
import { DemoPlan } from '../demo/DemoViews';
import CompPlanForm from '@/components/CompPlanForm';

export const metadata = { title: 'Comp plan — IOI' };

export default async function PlanPage() {
  const { user } = await currentUser();
  if (!user) return <DemoPlan />;
  const plan = await getCompPlan(user.id);
  return (
    <AccountShell current="/plan" email={user.email ?? ''}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {!plan && <div className="notice info">Pick the shape closest to your plan, put in your numbers, save. Everything stays editable.</div>}
        <CompPlanForm plan={plan} demo={false} onSave={savePlanAction} />
      </div>
    </AccountShell>
  );
}
