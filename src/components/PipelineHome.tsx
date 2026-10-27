'use client';

import { planForPeriod, type Calendar, type CompPlan, type DealInput, type Opening, type OpeningInput, type PeriodToDate, type QuarterToDate, type Quote } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import DealStage from '@/components/DealStage';
import Overview from '@/components/Overview';
import BookedList from '@/components/BookedList';
import { rateLift, type Line, type Targets } from '@/components/discounts';

type Result = { error?: string };
type BookMeta = { name?: string; bookedOn?: string };

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
  onOpening,
  onUpdateDeal,
  onRate,
  calendar,
  targets = {},
  onTarget,
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
  onSaveQuote: (q: { id?: string | null; name: string; deal: DealInput }) => Promise<Result & { id?: string }>;
  onDeleteQuote: (id: string) => Promise<Result>;
  onDeleteDeal: (id: string) => Promise<Result>;
  onOpening: (o: OpeningInput) => Promise<Result>;
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
      after={({ editDeal, copyDeal, editingId }) => (
        <BookedList
          plan={paying}
          deals={deals}
          onDelete={onDeleteDeal}
          onEdit={editDeal}
          editingId={editingId}
          onCopy={copyDeal}
          targets={targets}
          onTarget={onTarget}
          lift={rateLift(paying, ptd)}
        />
      )}
    />
  );
}
