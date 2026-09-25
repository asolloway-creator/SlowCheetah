import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getPeriodToDate, getQuarterToDate } from '@/lib/queries';
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
  // Only queried when the plan actually has a kicker — no extra query for
  // the common case.
  const qtd = plan.quarterly_kicker ? await getQuarterToDate(user.id) : null;

  return (
    <Shell current="/" email={user.email ?? ''} width="full">
      <DealStage plan={plan} ptd={ptd} qtd={qtd} demo={false} onSave={saveDealAction} />
    </Shell>
  );
}
