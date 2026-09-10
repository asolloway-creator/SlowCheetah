import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, listDeals } from '@/lib/queries';
import { deleteDealAction } from '../actions';
import { Shell } from '../AccountViews';
import { DemoHistory } from '../demo/DemoViews';
import HistoryView from '@/components/HistoryView';

export const metadata = { title: 'Your deals — IOI' };

export default async function HistoryPage() {
  const { user } = await currentUser();
  if (!user) return <DemoHistory />;
  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const deals = await listDeals(user.id);
  return (
    <Shell current="/history" email={user.email ?? ''} width="table">
      <HistoryView plan={plan} deals={deals} onDelete={deleteDealAction} />
    </Shell>
  );
}
