'use client';

import {
  planForPeriod,
  type Calendar,
  type CompPlan,
  type DealAccount,
  type DealInput,
  type Forecast,
  type LostReason,
  type Opening,
  type OpeningInput,
  type PeriodToDate,
  type QuarterToDate,
  type Quote,
} from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import DealStage from '@/components/DealStage';
import Overview from '@/components/Overview';
import BookedList from '@/components/BookedList';
import CloseOut from '@/components/CloseOut';
import { rateLift, type Line, type Targets } from '@/components/discounts';

type Result = { error?: string };
type AccountMeta = { id?: string | null; name?: string; oneDecision?: boolean; from?: { kind: 'quote' | 'deal'; id: string } | null } | null;
type BookMeta = { name?: string; bookedOn?: string; account?: AccountMeta; kind?: 'deal' | 'upsell' };

/**
 * The signed-in rep's one page: where they stand across the top, their
 * pipeline (open quotes and New deal) beside the deal they're working on,
 * and what they've booked under it. Booking a deal moves it from the
 * pipeline to the booked list, and the numbers at the top update in place
 * (every save revalidates the page).
 */
export default function PipelineHome({
  plan,
  ptd,
  qtd,
  opening,
  quotes,
  deals,
  onSave,
  onSaveQuote,
  onDeleteQuote,
  onDeleteDeal,
  onUnbookDeal,
  onOpening,
  onUpdateDeal,
  onRate,
  calendar,
  targets = {},
  onTarget,
  accounts = [],
  onForecast,
  onUpdateAccount,
  onAssignAccount,
  onLoseQuotes,
  onMakeOffer,
  onWithdrawOffer,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  opening: Opening | null;
  quotes: Quote[];
  deals: DealRow[];
  onSave: (deal: DealInput, meta?: BookMeta) => Promise<Result>;
  onUpdateDeal: (id: string, deal: DealInput, meta?: BookMeta) => Promise<Result>;
  onRate: (rate: number | null) => Promise<Result>;
  calendar: Calendar;
  /** The rep's own discount targets, per line. */
  targets?: Targets;
  onTarget?: (line: Line, pct: number | null) => Promise<Result>;
  onSaveQuote: (q: { id?: string | null; name: string; deal: DealInput; account?: AccountMeta }) => Promise<Result & { id?: string }>;
  onDeleteQuote: (id: string) => Promise<Result>;
  onDeleteDeal: (id: string) => Promise<Result>;
  /** A booked deal back to an open quote. */
  onUnbookDeal: (id: string) => Promise<Result & { id?: string }>;
  onOpening: (o: OpeningInput) => Promise<Result>;
  /** The rep's accounts: buyers with several deals. */
  accounts?: DealAccount[];
  /** The rep's call on open quotes. */
  onForecast?: (ids: string[], forecast: Forecast | null) => Promise<Result>;
  onUpdateAccount?: (id: string, patch: { name?: string; oneDecision?: boolean }) => Promise<Result>;
  onLoseQuotes?: (ids: string[], reason: LostReason | null) => Promise<Result>;
  /** A sign-by offer on an open quote, and taking it back. */
  onMakeOffer?: (id: string, deal: DealInput, expires: string) => Promise<Result>;
  onWithdrawOffer?: (id: string) => Promise<Result>;
  onAssignAccount?: (target: { kind: 'quote' | 'deal'; id: string }, account: AccountMeta) => Promise<Result & { accountId?: string | null }>;
}) {
  // The plan as it pays this period, with the rate from the rep's statement.
  const paying = planForPeriod(plan, opening);
  return (
    <DealStage
      plan={paying}
      ptd={ptd}
      qtd={qtd}
      demo={false}
      variant="app"
      onSave={onSave}
      onUpdateDeal={onUpdateDeal}
      calendar={calendar}
      targets={targets}
      quotes={quotes}
      onSaveQuote={onSaveQuote}
      onDeleteQuote={onDeleteQuote}
      onUnbookDeal={onUnbookDeal}
      accounts={accounts}
      onUpdateAccount={onUpdateAccount}
      onAssignAccount={onAssignAccount}
      onLoseQuotes={onLoseQuotes}
      top={({ onNew }) => (
        <Overview
          plan={paying}
          basePlan={plan}
          ptd={ptd}
          qtd={qtd}
          opening={opening}
          deals={deals}
          onOpening={onOpening}
          onRate={onRate}
          onNew={onNew}
          calendar={calendar}
          targets={targets}
        />
      )}
      after={({ editDeal, unbookDeal, editingId }) => (
        <>
          <CloseOut
            plan={paying}
            ptd={ptd}
            qtd={qtd}
            quotes={quotes}
            accounts={accounts}
            calendar={calendar}
            onForecast={onForecast}
            targets={targets}
            onMakeOffer={onMakeOffer}
            onWithdrawOffer={onWithdrawOffer}
          />
          <BookedList
          plan={paying}
          deals={deals}
          onDelete={onDeleteDeal}
          onEdit={editDeal}
          editingId={editingId}
          onUnbook={unbookDeal}
          targets={targets}
          onTarget={onTarget}
          lift={rateLift(paying, ptd)}
          accounts={accounts}
          calendar={calendar}
          onAddBooked={(i) =>
            onSave(
              { oneTime: 0, subscription: i.arr, subMode: 'acv', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 },
              { name: i.name, bookedOn: i.bookedOn, account: i.account, kind: i.kind },
            )
          }
        />
        </>
      )}
    />
  );
}
