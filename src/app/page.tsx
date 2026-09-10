import { redirect } from 'next/navigation';
import { periodLabel } from '@/lib/calc';
import { currentUser, getCompPlan, getPeriodToDate } from '@/lib/queries';
import { saveDealAction } from './actions';
import { Shell } from './AccountViews';
import { DemoDeal } from './demo/DemoViews';
import DealStage from '@/components/DealStage';

export default async function Home() {
  const { user } = await currentUser();
  if (!user) return <DemoDeal />;

  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const { deals: _deals, ...ptd } = await getPeriodToDate(user.id, plan);
  void _deals;

  return (
    <Shell current="/" email={user.email ?? ''}>
      <h1 className="page-title">New deal · {periodLabel(plan.period)}</h1>
      <DealStage plan={plan} ptd={ptd} demo={false} onSave={saveDealAction} />
    </Shell>
  );
}
