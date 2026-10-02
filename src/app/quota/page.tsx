import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getPeriodToDate, getQuarterToDate } from '@/lib/queries';
import { saveOpeningAction } from '../actions';
import { Shell } from '../AccountViews';
import { DemoQuota } from '../demo/DemoViews';
import QuotaView from '@/components/QuotaView';

export const metadata = { title: 'Where you stand · IOI' };

export default async function QuotaPage() {
  const { user } = await currentUser();
  if (!user) return <DemoQuota />;
  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const [{ deals, opening, ...ptd }, qtd] = await Promise.all([
    getPeriodToDate(user.id, plan),
    plan.quarterly_kicker ? getQuarterToDate(user.id, plan) : Promise.resolve(null),
  ]);
  return (
    <Shell current="/quota" email={user.email ?? ''} width="narrow">
      <QuotaView plan={plan} ptd={ptd} qtd={qtd} deals={deals} opening={opening} onOpening={saveOpeningAction} />
    </Shell>
  );
}
