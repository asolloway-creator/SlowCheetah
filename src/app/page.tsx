import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getPeriodToDate, getQuarterToDate, listQuotes } from '@/lib/queries';
import { starterDeal } from '@/lib/calc';
import { deleteQuoteAction, saveDealAction, saveQuoteAction } from './actions';
import { Shell } from './AccountViews';
import { DemoDeal } from './demo/DemoViews';
import DealStage from '@/components/DealStage';

export default async function Home() {
  const { user } = await currentUser();
  if (!user) return <DemoDeal />;

  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const { deals: _deals, opening: _opening, ...ptd } = await getPeriodToDate(user.id, plan);
  void _deals;
  void _opening;
  // Only queried when the plan actually has a kicker — no extra query for
  // the common case.
  const [qtd, quotes] = await Promise.all([
    plan.quarterly_kicker ? getQuarterToDate(user.id, plan) : Promise.resolve(null),
    listQuotes(user.id),
  ]);
  // Never an empty card: back to the quote they were last working, or a deal
  // sized from where they stand.
  const latest = quotes[0] ?? null;

  return (
    <Shell current="/" email={user.email ?? ''} width="full">
      <DealStage
        plan={plan}
        ptd={ptd}
        qtd={qtd}
        demo={false}
        onSave={saveDealAction}
        quotes={quotes}
        onSaveQuote={saveQuoteAction}
        onDeleteQuote={deleteQuoteAction}
        initialDeal={latest?.deal ?? starterDeal(plan, ptd.creditBooked)}
        initialQuoteId={latest?.id ?? null}
      />
    </Shell>
  );
}
