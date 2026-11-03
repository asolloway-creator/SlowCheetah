import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser, getCompPlan, getOpening, getPeriodToDate, getQuarterToDate, getTargets, listAccounts, listDeals, listLost, listQuotes, repTimeZone } from '@/lib/queries';
import { calendarInZone } from '@/lib/calc';
import { lastPeriodCredit, nextPeriodStart, quarterView } from '@/lib/rollover';
import {
  deleteDealAction,
  deleteQuoteAction,
  saveDealAction,
  saveOpeningAction,
  saveQuoteAction,
  saveRateAction,
  setDisplayUnitAction,
  setCloseDateAction,
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
import PipelineHome from '@/components/PipelineHome';
import type { View } from '@/components/app/AppShell';
import { NAV_COOKIE } from '@/components/app/nav';

/** A search param as one string, or undefined. */
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The signed-in workspace for one view: everything the views read, loaded
 * the same way for each (so moving between them never shows stale numbers),
 * then the view in the app frame. Signed out goes to sign-in; no plan yet
 * goes to putting one in.
 */
export default async function Workspace({ view, search = {} }: { view: View; search?: Record<string, string | string[] | undefined> }) {
  const { user } = await currentUser();
  if (!user) redirect(view === 'home' ? '/login' : `/login?next=/${view}`);

  const plan = await getCompPlan(user.id);
  if (!plan) redirect('/plan');
  const timeZone = await repTimeZone();
  const calendar = calendarInZone(plan.period, timeZone);
  // A sign-by offer that ran out goes back to its own numbers before anything reads it.
  await revertExpiredOffers(calendar.today);
  // Only queried when the plan actually has a kicker — no extra query for
  // the common case.
  const [{ deals: _period, opening, ...ptd }, qtd, quotes, deals, targets, accounts, saved, lost] = await Promise.all([
    getPeriodToDate(user.id, plan),
    plan.quarterly_kicker ? getQuarterToDate(user.id, plan) : Promise.resolve(null),
    // Calls and "carried" are read against where this period began.
    listQuotes(user.id, { start: calendar.periodStart, next: nextPeriodStart(plan.period, calendar.periodStart), timeZone }),
    listDeals(user.id),
    getTargets(user.id),
    listAccounts(user.id),
    getOpening(user.id),
    // For the win rate: the last 90 days, read with a day to spare.
    listLost(user.id, new Date(Date.parse(calendar.today) - 91 * 86400000)),
  ]);
  void _period;
  // The quarter as one timeline, and how the period just ended came out.
  const quarter = qtd ? quarterView(deals, qtd.saasArrBooked, calendar.today, timeZone) : null;
  const lastCredit = lastPeriodCredit(plan.period, calendar.periodStart, deals, saved, timeZone);

  return (
    <PipelineHome
      view={view}
      email={user.email ?? ''}
      navPinned={(await cookies()).get(NAV_COOKIE)?.value === '1'}
      open={{ quote: one(search.quote), deal: one(search.deal), fresh: one(search.new) }}
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
      onUnit={setDisplayUnitAction}
      onCloseDate={setCloseDateAction}
      lost={lost}
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
  );
}
