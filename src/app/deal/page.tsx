import { redirect } from 'next/navigation';
import Masthead from '@/components/Masthead';
import Footnote from '@/components/Footnote';
import { getCompPlan, getMonthToDate, requireUser } from '@/lib/queries';
import DealBuilder from './DealBuilder';

export const metadata = { title: 'New deal — IOI' };

export default async function DealPage() {
  const { user } = await requireUser();
  const plan = await getCompPlan();
  if (!plan) redirect('/setup');

  const { unitsBooked, arrBooked } = await getMonthToDate();

  return (
    <div className="app">
      <Masthead email={user.email ?? ''} current="/deal" />
      <DealBuilder plan={plan} mtd={{ unitsBooked, arrBooked }} />
      <Footnote />
    </div>
  );
}
