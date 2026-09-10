import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getPeriodToDate } from '@/lib/queries';
import { AccountShell } from '../AccountViews';
import { DemoQuota } from '../demo/DemoViews';
import QuotaView from '@/components/QuotaView';

export const metadata = { title: 'Quota — IOI' };

export default async function QuotaPage() {
  const { user } = await currentUser();
  if (!user) return <DemoQuota />;
  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const { deals, ...ptd } = await getPeriodToDate(user.id, plan);
  return (
    <AccountShell current="/quota" email={user.email ?? ''}>
      <QuotaView plan={plan} ptd={ptd} deals={deals} />
    </AccountShell>
  );
}
