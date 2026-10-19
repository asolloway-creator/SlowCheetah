import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getPeriodToDate, getQuarterToDate, listDeals, listQuotes } from '@/lib/queries';
import { deleteDealAction, deleteQuoteAction, saveDealAction, saveOpeningAction, saveQuoteAction } from './actions';
import { Shell } from './AccountViews';
import { DemoDeal } from './demo/DemoViews';
import PipelineHome from '@/components/PipelineHome';

export default async function Home() {
  const { user } = await currentUser();
  if (!user) return <DemoDeal />;

  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  // Only queried when the plan actually has a kicker — no extra query for
  // the common case.
  const [{ deals: _period, opening, ...ptd }, qtd, quotes, deals] = await Promise.all([
    getPeriodToDate(user.id, plan),
    plan.quarterly_kicker ? getQuarterToDate(user.id, plan) : Promise.resolve(null),
    listQuotes(user.id),
    listDeals(user.id),
  ]);
  void _period;

  return (
    <Shell current="/" email={user.email ?? ''} width="full">
      <PipelineHome
        plan={plan}
        ptd={ptd}
        qtd={qtd}
        opening={opening}
        quotes={quotes}
        deals={deals}
        onSave={saveDealAction}
        onSaveQuote={saveQuoteAction}
        onDeleteQuote={deleteQuoteAction}
        onDeleteDeal={deleteDealAction}
        onOpening={saveOpeningAction}
      />
    </Shell>
  );
}
