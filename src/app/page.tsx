import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getPeriodToDate, getQuarterToDate, getTargets, listDeals, listQuotes, repTimeZone } from '@/lib/queries';
import { calendarInZone } from '@/lib/calc';
import {
  deleteDealAction,
  deleteQuoteAction,
  saveDealAction,
  saveOpeningAction,
  saveQuoteAction,
  saveRateAction,
  saveTargetAction,
  updateDealAction,
} from './actions';
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
  const [{ deals: _period, opening, ...ptd }, qtd, quotes, deals, targets] = await Promise.all([
    getPeriodToDate(user.id, plan),
    plan.quarterly_kicker ? getQuarterToDate(user.id, plan) : Promise.resolve(null),
    listQuotes(user.id),
    listDeals(user.id),
    getTargets(user.id),
  ]);
  void _period;
  const calendar = calendarInZone(plan.period, await repTimeZone());

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
        onUpdateDeal={updateDealAction}
        onRate={saveRateAction}
        targets={targets}
        onTarget={saveTargetAction}
        calendar={calendar}
      />
    </Shell>
  );
}
