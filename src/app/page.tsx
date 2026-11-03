import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getOpening, getPeriodToDate, getQuarterToDate, getTargets, listAccounts, listDeals, listQuotes, repTimeZone } from '@/lib/queries';
import { calendarInZone } from '@/lib/calc';
import { lastPeriodCredit, quarterView } from '@/lib/rollover';
import {
  deleteDealAction,
  deleteQuoteAction,
  saveDealAction,
  saveOpeningAction,
  saveQuoteAction,
  saveRateAction,
  saveTargetAction,
  assignAccountAction,
  loseQuotesAction,
  makeOfferAction,
  revertExpiredOffers,
  withdrawOfferAction,
  setForecastAction,
  unbookDealAction,
  updateAccountAction,
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
  const timeZone = await repTimeZone();
  const calendar = calendarInZone(plan.period, timeZone);
  // A sign-by offer that ran out goes back to its own numbers before anything reads it.
  await revertExpiredOffers(calendar.today);
  // Only queried when the plan actually has a kicker — no extra query for
  // the common case.
  const [{ deals: _period, opening, ...ptd }, qtd, quotes, deals, targets, accounts, saved] = await Promise.all([
    getPeriodToDate(user.id, plan),
    plan.quarterly_kicker ? getQuarterToDate(user.id, plan) : Promise.resolve(null),
    // Calls and "carried" are read against where this period began.
    listQuotes(user.id, { start: calendar.periodStart, timeZone }),
    listDeals(user.id),
    getTargets(user.id),
    listAccounts(user.id),
    getOpening(user.id),
  ]);
  void _period;
  // The quarter as one timeline, and how the period just ended came out.
  const quarter = qtd ? quarterView(deals, qtd.saasArrBooked, calendar.today, timeZone) : null;
  const lastCredit = lastPeriodCredit(plan.period, calendar.periodStart, deals, saved, timeZone);

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
        onUnbookDeal={unbookDealAction}
        onOpening={saveOpeningAction}
        onUpdateDeal={updateDealAction}
        onRate={saveRateAction}
        targets={targets}
        onTarget={saveTargetAction}
        calendar={calendar}
        quarter={quarter}
        lastCredit={lastCredit}
        accounts={accounts}
        onForecast={setForecastAction}
        onUpdateAccount={updateAccountAction}
        onAssignAccount={assignAccountAction}
        onLoseQuotes={loseQuotesAction}
        onMakeOffer={makeOfferAction}
        onWithdrawOffer={withdrawOfferAction}
      />
    </Shell>
  );
}
