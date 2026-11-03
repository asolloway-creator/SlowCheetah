'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import BookedList, { DiscountsView } from '@/components/BookedList';
import AppShell, { type View } from '@/components/app/AppShell';
import CloseOut from '@/components/CloseOut';
import PipelineHealth from '@/components/PipelineHealth';
import { quarterView, type QuarterView } from '@/lib/rollover';
import { rateLift, type Line, type Targets } from '@/components/discounts';

type Result = { error?: string };
type AccountMeta = { id?: string | null; name?: string; oneDecision?: boolean; from?: { kind: 'quote' | 'deal'; id: string } | null } | null;
type BookMeta = { name?: string; bookedOn?: string; account?: AccountMeta; kind?: 'deal' | 'upsell' };

/**
 * The signed-in workspace, one view at a time inside the app frame
 * (AppShell): Home (where the rep stands), the Deal desk (pricing a deal),
 * Forecast (this period's close), Pipeline (its health), Closed (what's
 * booked) and Discounts. Every view reads the same data; every save
 * revalidates it. `linkBase` points the sidebar at a fixture instead of the
 * real pages (dev only), and `open` is what the deal desk opens on.
 */
export default function PipelineHome({
  view = 'home',
  email = '',
  linkBase,
  open = {},
  navPinned = false,
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
  quarter = null,
  lastCredit = 0,
  onUnit,
  onCloseDate,
  lost = [],
}: {
  view?: View;
  email?: string;
  linkBase?: string;
  /** What the deal desk opens on: a quote, a booked deal to change, or a new deal (a stamp). */
  open?: { quote?: string; deal?: string; fresh?: string };
  /** The sidebar pinned open (the rep's choice, from a cookie). */
  navPinned?: boolean;
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
  /** The calendar quarter month by month (with a Quarterly Bonus), and the
   *  quota credit the period just ended came to. */
  quarter?: QuarterView | null;
  lastCredit?: number;
  /** ARR or MRR on screen, saved with the plan. */
  onUnit?: (unit: 'arr' | 'mrr') => Promise<Result>;
  /** When the rep expects open quotes to close. */
  onCloseDate?: (ids: string[], date: string | null) => Promise<Result>;
  /** Quotes marked lost in the last 90 days, for the win rate. */
  lost?: { closedAt: string; reason: string | null }[];
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
  // ARR or MRR: shows at once everywhere below, then saves.
  const [unit, setUnit] = useState<'arr' | 'mrr'>(plan.display_unit ?? 'arr');
  const shown: CompPlan = { ...plan, display_unit: unit };
  function pickUnit(u: 'arr' | 'mrr') {
    setUnit(u);
    void onUnit?.(u);
  }
  // The plan as it pays this period, with the rate from the rep's statement.
  const paying = planForPeriod(shown, opening);
  // Without the server's (in the rep's own zone), the browser's.
  const quarterNow = quarter ?? (qtd ? quarterView(deals, qtd.saasArrBooked, calendar.today, Intl.DateTimeFormat().resolvedOptions().timeZone) : null);
  const router = useRouter();
  const href = linkBase ? (v: View) => `${linkBase}${linkBase.includes('?') ? '&' : '?'}v=${v}` : undefined;
  const to = (v: View, q = '') => {
    const base = href ? href(v) : v === 'home' ? '/' : `/${v}`;
    return q ? `${base}${base.includes('?') ? '&' : '?'}${q}` : base;
  };
  const lift = rateLift(paying, ptd);

  let content: React.ReactNode;
  if (view === 'deals') {
    const editRow = open.deal ? (deals.find((d) => d.id === open.deal) ?? null) : null;
    content = (
      <DealStage
        // A new address (a quote, a deal, New deal again) starts the desk over.
        key={`${open.quote ?? ''}|${open.deal ?? ''}|${open.fresh ?? ''}`}
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
        initialQuoteId={open.quote ?? null}
        initialEdit={editRow}
        bookedHref={to('closed')}
      />
    );
  } else if (view === 'forecast') {
    content = (
      <div className="as-view">
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
          onCloseDate={onCloseDate}
          openHref={(id) => to('deals', `quote=${id}`)}
        />
        {!quotes.length && <p className="as-empty">No open quotes. Save a quote on the Deal Desk and it shows here to call.</p>}
      </div>
    );
  } else if (view === 'pipeline') {
    content = (
      <div className="as-view">
        <PipelineHealth
          plan={paying}
          ptd={ptd}
          qtd={qtd}
          quotes={quotes}
          accounts={accounts}
          deals={deals}
          lost={lost}
          calendar={calendar}
          onCloseDate={onCloseDate}
          openHref={(id) => to('deals', `quote=${id}`)}
        />
      </div>
    );
  } else if (view === 'closed') {
    content = (
      <div className="as-view">
        <BookedList
          plan={paying}
          deals={deals}
          report={false}
          onDelete={onDeleteDeal}
          onEdit={(d) => router.push(to('deals', `deal=${d.id}`))}
          onUnbook={(d) => onUnbookDeal(d.id)}
          targets={targets}
          onTarget={onTarget}
          lift={lift}
          accounts={accounts}
          calendar={calendar}
          onAddBooked={(i) =>
            onSave(
              { oneTime: 0, subscription: i.arr, subMode: 'acv', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 },
              { name: i.name, bookedOn: i.bookedOn, account: i.account, kind: i.kind },
            )
          }
        />
      </div>
    );
  } else if (view === 'discounts') {
    content = (
      <div className="as-view">
        <DiscountsView plan={paying} deals={deals} targets={targets} onTarget={onTarget} lift={lift} />
      </div>
    );
  } else {
    content = (
      <Overview
        plan={paying}
        basePlan={shown}
        ptd={ptd}
        qtd={qtd}
        opening={opening}
        deals={deals}
        onOpening={onOpening}
        onRate={onRate}
        calendar={calendar}
        targets={targets}
        quarter={quarterNow}
        lastCredit={lastCredit}
      />
    );
  }

  return (
    <AppShell
      view={view}
      email={email}
      unit={plan.quota_basis === 'arr' && onUnit ? unit : undefined}
      onUnit={plan.quota_basis === 'arr' && onUnit ? pickUnit : undefined}
      href={href}
      pinned={navPinned}
    >
      {content}
    </AppShell>
  );
}
