import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, listDeals } from '@/lib/queries';
import { deleteDealAction } from '../actions';
import { AccountShell } from '../AccountViews';
import { DemoHistory } from '../demo/DemoViews';
import HistoryView from '@/components/HistoryView';

export const metadata = { title: 'Deal history — IOI' };

export default async function HistoryPage() {
  const { user } = await currentUser();
  if (!user) return <DemoHistory />;
  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const deals = await listDeals(user.id);
  return (
    <AccountShell current="/history" email={user.email ?? ''}>
      <HistoryView plan={plan} deals={deals} onDelete={deleteDealAction} />
    </AccountShell>
  );
}
