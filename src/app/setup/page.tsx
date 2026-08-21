import Masthead from '@/components/Masthead';
import Footnote from '@/components/Footnote';
import { getCompPlan, requireUser } from '@/lib/queries';
import CompPlanForm from './CompPlanForm';

export const metadata = { title: 'Comp plan — IOI' };

export default async function SetupPage() {
  const { user } = await requireUser();
  const plan = await getCompPlan();

  return (
    <div className="app">
      <Masthead email={user.email ?? ''} current="/setup" />
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {!plan && (
          <div className="notice info">
            We&rsquo;ve pre-filled the MarginEdge plan — $107K quarterly ARR quota, 2 months of
            SaaS per deal, 25% accelerator. Check the numbers and save. Everything stays
            editable.
          </div>
        )}
        <CompPlanForm plan={plan} />
      </div>
      <Footnote />
    </div>
  );
}
