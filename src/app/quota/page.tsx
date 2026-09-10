import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getPeriodToDate } from '@/lib/queries';
import { Shell } from '../AccountViews';
import { DemoQuota } from '../demo/DemoViews';
import QuotaView from '@/components/QuotaView';

export const metadata = { title: 'Where you stand — IOI' };

export default async function QuotaPage() {
  const { user } = await currentUser();
  if (!user) return <DemoQuota />;
  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const { deals, ...ptd } = await getPeriodToDate(user.id, plan);
  return (
    <Shell current="/quota" email={user.email ?? ''} width="narrow">
      <QuotaView plan={plan} ptd={ptd} deals={deals} />
    </Shell>
  );
}
