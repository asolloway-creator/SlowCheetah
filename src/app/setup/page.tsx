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
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {!plan && (
          <div className="notice info">
            Set up your comp plan once and every deal you enter is measured against
            it. You can change it later.
          </div>
        )}
        <CompPlanForm plan={plan} />
      </div>
      <Footnote />
    </div>
  );
}
