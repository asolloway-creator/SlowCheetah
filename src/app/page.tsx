import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getPeriodToDate } from '@/lib/queries';
import { saveDealAction } from './actions';
import { AccountShell } from './AccountViews';
import { DemoDeal } from './demo/DemoViews';
import DealBuilder from '@/components/DealBuilder';

export default async function Home() {
  const { user } = await currentUser();
  if (!user) return <DemoDeal />;

  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const { deals: _deals, ...ptd } = await getPeriodToDate(user.id, plan);
  void _deals;

  return (
    <AccountShell current="/" email={user.email ?? ''}>
      <DealBuilder plan={plan} ptd={ptd} demo={false} onSave={saveDealAction} />
    </AccountShell>
  );
}
