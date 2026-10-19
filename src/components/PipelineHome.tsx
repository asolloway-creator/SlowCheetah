'use client';

import type { CompPlan, DealInput, Opening, OpeningInput, PeriodToDate, QuarterToDate, Quote } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import DealStage from '@/components/DealStage';
import StandingBand from '@/components/Standing';
import BookedList from '@/components/BookedList';

type Result = { error?: string };

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
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  opening: Opening | null;
  quotes: Quote[];
  deals: DealRow[];
  onSave: (deal: DealInput) => Promise<Result>;
  onSaveQuote: (q: { id?: string | null; name: string; deal: DealInput }) => Promise<Result & { id?: string }>;
  onDeleteQuote: (id: string) => Promise<Result>;
  onDeleteDeal: (id: string) => Promise<Result>;
  onOpening: (o: OpeningInput) => Promise<Result>;
}) {
  return (
    <>
      <StandingBand plan={plan} ptd={ptd} qtd={qtd} opening={opening} onOpening={onOpening} />
      <DealStage
        plan={plan}
        ptd={ptd}
        qtd={qtd}
        demo={false}
        onSave={onSave}
        quotes={quotes}
        onSaveQuote={onSaveQuote}
        onDeleteQuote={onDeleteQuote}
        after={<BookedList plan={plan} deals={deals} onDelete={onDeleteDeal} />}
      />
    </>
  );
}
