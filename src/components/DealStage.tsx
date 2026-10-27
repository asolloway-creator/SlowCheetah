'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  calc,
  periodLabel,
  type CompPlan,
  type DealInput,
  type PeriodToDate,
  type QuarterToDate,
  type Quote,
} from '@/lib/calc';
import { fmt, fmtCredit, fmtMoney, fmtPctShort, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import DealForm from '@/components/DealForm';
import Outcome from '@/components/Outcome';
import DiscountSlider from '@/components/DiscountSlider';
import Ledger, { type LedgerRow } from '@/components/Ledger';
import PinnedOutcome from '@/components/PinnedOutcome';
import TweenedMoney from '@/components/TweenedMoney';
import KickerOutcome from '@/components/KickerOutcome';
import DealResult from '@/components/DealResult';
import QuotesRail, { quoteLabel } from '@/components/QuotesRail';
import { track, trackOnce, type TrackContext } from '@/lib/track';
import type { DealRow } from '@/lib/queries';
import type { Targets } from '@/components/discounts';
import {
  EMPTY,
  SAMPLE,
  costOf,
  crossEffect,
  holdLinePct,
  kickerCrossDiscountPct,
  kickerGroundingDetail,
  kickerOutcomeCopy,
  isEmpty,
  outcome,
  outcomeCopy,
  sliderCaption,
} from '@/components/opening';
import { showcaseScript, type ShowcaseScript } from '@/components/showcase';
import { useShowcase, type Beat } from '@/components/useShowcase';

/** Splits "This deal triggers your accelerator. Every deal after..." into a bold lead and the rest. */
function leadSentence(s: string): [string, string] {
  const i = s.indexOf('. ');
  return i > 0 ? [s.slice(0, i + 1), s.slice(i + 2)] : [s, ''];
}

/**
 * The landing card's narration, one line per beat of its story: the ask,
 * the loss the moment the bonus line is crossed, IOI pointing at where to
 * stop, then both outcomes side by side. Every figure comes from the script.
 */
function Narration({ beat, crossed, s }: { beat: Beat; crossed: boolean; s: ShowcaseScript }) {
  let line: ReactNode;
  if (beat === 'ready') line = 'A prospect wants a discount.';
  else if (beat === 'ask')
    line = crossed ? <>Past {fmtPctShort(s.line)}, your Quarterly&nbsp;Bonus is gone.</> : <>Prospect asks for {fmtPctShort(s.ask)} off.</>;
  else if (beat === 'hold') line = 'IOI shows you where to stop.';
  else {
    line = (
      <>
        At {fmtPctShort(s.ask)}, you lose a <span className="is-red">{fmt(s.lost)}</span> Quarterly&nbsp;Bonus. At{' '}
        {fmtPctShort(s.hold)}, you keep it.
      </>
    );
  }
  const key = beat === 'ask' && crossed ? 'lost' : beat === 'free' ? 'done' : beat;
  return (
    <div className="dc-narration">
      <p key={key} className="dc-narration-line fade-up">
        {line}
      </p>
    </div>
  );
}

/** The other side of the story's last point, under the slider once it holds. */
const customerSide = (s: ShowcaseScript) =>
  `${s.ask - s.hold === 1 ? 'That last point is' : 'The difference is'} worth ${fmt(s.customerYear)} a year to your prospect.`;

/**
 * The deal page. Left: the intro (a title, or the landing hero), then the
 * deal builder on a panel that rises under the result. Right: the result
 * card on a sunflower block, then where the period stands. Works against
 * the browser store (demo) and the server actions (signed in) alike.
 *
 * On the landing page, before a visitor has a plan of their own, it's the
 * showcase instead: the hero and the card alone, the card playing its story
 * (useShowcase). The builder comes with their own plan.
 */
type BookMeta = { name?: string; bookedOn?: string };

/** A booked deal's lines, as the card holds them. */
function dealFromRow(row: DealRow): DealInput {
  return {
    oneTime: row.one_time_amount,
    subscription: row.subscription_amount,
    subMode: row.subscription_mode,
    units: Math.max(1, row.units),
    oneTimeDiscountPct: row.one_time_discount_pct,
    subscriptionDiscountPct: row.subscription_discount_pct,
    hardware: row.hardware_amount ?? 0,
    hardwareDiscountPct: row.hardware_discount_pct ?? 0,
  };
}

/** 'YYYY-MM-DD' of a stored moment, in this browser's zone. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DealStage({
  plan,
  ptd: ptdIn,
  qtd: qtdIn,
  demo,
  onSave,
  initialDeal,
  intro,
  variant = 'stage',
  top,
  after,
  onUpdateDeal,
  calendar,
  targets,
  quotes = [],
  onSaveQuote,
  onDeleteQuote,
  initialQuoteId = null,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  /** Only needed (and only fetched by callers) when plan.quarterly_kicker
   *  is set — the calendar-quarter aggregate the bonus card measures against. */
  qtd?: QuarterToDate | null;
  demo: boolean;
  /** Books the deal; in the workspace, with its name and the day it was booked. */
  onSave: (deal: DealInput, meta?: BookMeta) => Promise<{ error?: string }>;
  /** Saves changes to a booked deal reopened from the booked list. */
  onUpdateDeal?: (id: string, deal: DealInput, meta?: BookMeta) => Promise<{ error?: string }>;
  /** Today and the period's first day in the rep's zone ('YYYY-MM-DD'): the
   *  range a booked day can be picked from. */
  calendar?: { today: string; periodStart: string };
  /** The rep's own discount targets, shown where each discount is typed. */
  targets?: Targets;
  initialDeal?: DealInput;
  /** Top-left content beside the result card. Defaults to a page title. */
  intro?: ReactNode;
  /** 'app' is the signed-in workspace: no stage dressing (the sunflower
   *  block, the rising panel, page titles), the open quotes in a column of
   *  their own beside the fields and the card, everything at working size. */
  variant?: 'stage' | 'app';
  /** Above the workspace (the home page's numbers), given "New deal". */
  top?: (p: { onNew: () => void }) => ReactNode;
  /** Under the deal fields (the home page's booked deals), given a way to
   *  reopen a booked deal in the card. */
  after?:
    | ReactNode
    | ((api: { editDeal: (row: DealRow) => void; copyDeal: (row: DealRow) => void; editingId: string | null }) => ReactNode);
  /** The rep's open quotes, most recently worked first. */
  quotes?: Quote[];
  onSaveQuote?: (q: { id?: string | null; name: string; deal: DealInput }) => Promise<{ error?: string; id?: string }>;
  onDeleteQuote?: (id: string) => Promise<{ error?: string }>;
  /** The quote the page opens on (signed in: the most recent one). */
  initialQuoteId?: string | null;
}) {
  const [deal, setDeal] = useState<DealInput>(initialDeal ?? (demo ? SAMPLE : EMPTY));
  // The open quote on the card, if the deal on it is one. Quotes are deals the
  // rep is still working: saved to come back to, booked when they close.
  const [activeQuote, setActiveQuote] = useState<string | null>(initialQuoteId);
  const [naming, setNaming] = useState(false);
  const [quoteName, setQuoteName] = useState('');
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ booked?: boolean; updated?: boolean; quoted?: boolean; error?: string }>({});
  // A booked deal reopened to change it, and what's typed in for booking.
  const [editing, setEditing] = useState<{ id: string; deal: DealInput; row: DealRow } | null>(null);
  // A booked deal in the card is priced against the period without itself,
  // or it would count twice.
  const ptd = useMemo<PeriodToDate>(() => {
    if (!editing) return ptdIn;
    const r = editing.row;
    return {
      ...ptdIn,
      creditBooked: Math.max(0, ptdIn.creditBooked - r.quota_credit),
      commissionBooked: Math.max(0, ptdIn.commissionBooked - r.commission_base),
      earnedBooked: Math.max(0, ptdIn.earnedBooked - r.commission_earned),
      hardwareBooked: Math.max(0, (ptdIn.hardwareBooked ?? 0) - (r.hardware_commission ?? 0)),
    };
  }, [ptdIn, editing]);
  const qtd = useMemo<QuarterToDate | null | undefined>(() => {
    if (!editing || !qtdIn) return qtdIn;
    return {
      saasArrBooked: Math.max(0, qtdIn.saasArrBooked - editing.row.arr),
      saasCommissionBooked: Math.max(0, qtdIn.saasCommissionBooked - editing.row.saas_commission),
    };
  }, [qtdIn, editing]);
  const [bookName, setBookName] = useState('');
  const [bookedOn, setBookedOn] = useState(calendar?.today ?? '');
  // "Booked" says its piece and goes, so it never sits on the next deal.
  useEffect(() => {
    if (!msg.booked && !msg.updated && !msg.quoted) return;
    const t = window.setTimeout(() => setMsg((m) => (m.booked || m.updated || m.quoted ? {} : m)), 6000);
    return () => window.clearTimeout(t);
  }, [msg.booked, msg.updated, msg.quoted]);

  // The landing page's card: the stock sample, before the visitor has a plan
  // of their own. No deal builder and no booking. The card plays its one
  // story by itself (useShowcase), then hands the slider over. The builder
  // arrives with their own plan, where its numbers mean something.
  const showcase = demo;
  const script = useMemo(() => (showcase ? showcaseScript(plan, SAMPLE, ptd, qtd ?? null) : null), [showcase, plan, ptd, qtd]);
  // The story's own moves are never the visitor's input: never dirty, so
  // they can't count as a drag or a bonus-line crossing.
  const setDiscount = useCallback((pct: number) => {
    setDeal((d) => ({ ...d, subscriptionDiscountPct: pct }));
    setDirty(false);
  }, []);
  const show = useShowcase({
    enabled: showcase,
    ask: script?.ask ?? null,
    hold: script?.hold ?? null,
    setDiscount,
    targetId: 'deal-card',
  });

  const quotesOn = !showcase && Boolean(onSaveQuote);
  const active = quotes.find((q) => q.id === activeQuote) ?? null;

  // Old "?plan=1" links (the plan dialog this page used to open) now go to
  // creating an account, where a plan is put in.
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (demo && searchParams.get('plan') === '1') router.replace('/signup');
  }, [demo, searchParams, router]);


  const o = useMemo(() => outcome(plan, deal, ptd), [plan, deal, ptd]);
  // The open quotes besides the one on the card, priced where the period
  // stands: what crossing the accelerator would add to them.
  const pipelineAtStake = useMemo(() => {
    const others = quotes.filter((q) => q.id !== activeQuote);
    let base = 0;
    let commissionable = 0;
    for (const q of others) {
      const rq = calc(plan, q.deal, ptd);
      base += rq.commissionBase;
      commissionable += rq.commissionable;
    }
    return { count: others.length, base, commissionable };
  }, [quotes, activeQuote, plan, ptd]);
  const copy = useMemo(() => outcomeCopy(plan, deal, o, ptd, pipelineAtStake), [plan, deal, o, ptd, pipelineAtStake]);
  // Independent of the accelerator's own outcome above — this deal can cross
  // the accelerator and cost a quarterly kicker tier at the same time. null
  // whenever the plan has no quarterly_kicker or qtd wasn't fetched.
  const xEffect = useMemo(() => (qtd ? crossEffect(plan, o, qtd) : null), [plan, o, qtd]);
  const xCopy = useMemo(() => kickerOutcomeCopy(plan, xEffect, qtd ?? null), [plan, xEffect, qtd]);
  // Where the tier is lost, not whether it currently is — positions the
  // slider's line. xEffect.costsATier at the live discount is still the only
  // thing that decides red vs. not.
  const kickerCrossPct = useMemo(() => kickerCrossDiscountPct(plan, o, qtd ?? null), [plan, o, qtd]);
  // Past a line, the most the discount can be and still keep what it's costing.
  const holdAt = useMemo(() => holdLinePct(plan, deal, ptd, qtd ?? null), [plan, deal, ptd, qtd]);
  // No bonus at stake but the deal crosses the accelerator at full price:
  // mark the most it can be discounted and still cross, the same way.
  const accelLinePct = !showcase && kickerCrossPct === null ? o.safeDiscountPct : null;
  const lineKind: 'bonus' | 'accelerator' = kickerCrossPct === null && accelLinePct !== null ? 'accelerator' : 'bonus';
  const groundingDetail = kickerGroundingDetail(plan, qtd ?? null);
  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const empty = isEmpty(deal);
  const subCost = costOf(plan, deal, ptd, 'subscriptionDiscountPct');
  // Anything red on screen — money left on the table without crossing, the
  // accelerator blocked, or a kicker tier lost. The book nudge reads as "go
  // ahead, click this", exactly wrong while the page says this costs you.
  const isCostly = copy.secondary?.tone === 'red' || xCopy?.tone === 'red';

  const ctx: TrackContext = demo ? 'sample' : 'account';
  // The signature moment: a discount the rep chose just cost them a bonus
  // tier. Only counted when their own edit caused it (dirty), never a deal
  // that loads already past the line.
  const crossed = Boolean(xEffect?.costsATier);
  const wasCrossed = useRef(crossed);
  useEffect(() => {
    if (crossed && !wasCrossed.current && dirty) trackOnce('bonus_line_crossed', ctx);
    wasCrossed.current = crossed;
  }, [crossed, dirty, ctx]);

  const set = <K extends keyof DealInput>(k: K, v: DealInput[K]) => {
    setDeal((d) => ({ ...d, [k]: v }));
    setDirty(true);
    setMsg((m) => (m.booked || m.updated ? {} : m));
  };

  async function book() {
    setPending(true);
    setMsg({});
    // onSave is a server action call — a network failure or timeout rejects
    // rather than resolving to {error}, which would leave pending stuck.
    let res: { error?: string };
    const meta = app ? { name: bookName.trim() || active?.name || '', bookedOn: bookedOn || undefined } : undefined;
    try {
      res = editing && onUpdateDeal ? await onUpdateDeal(editing.id, deal, meta) : await onSave(deal, meta);
    } catch {
      setPending(false);
      setMsg({ error: 'Could not reach the server. Check your connection and try again.' });
      return;
    }
    setPending(false);
    if (res.error) {
      setMsg({ error: res.error });
    } else if (editing) {
      setEditing(null);
      setMsg({ updated: true });
      setDeal(EMPTY);
      setDirty(false);
      setBookName('');
      setBookedOn(calendar?.today ?? '');
    } else {
      track('deal_booked', ctx);
      // A booked quote is a closed deal now: off the open list.
      if (activeQuote && onDeleteQuote) {
        try {
          await onDeleteQuote(activeQuote);
        } catch {}
      }
      setActiveQuote(null);
      setMsg({ booked: true });
      setDeal(EMPTY);
      setDirty(false);
      setBookName('');
      setBookedOn(calendar?.today ?? '');
    }
  }

  function openQuote(q: Quote) {
    setActiveQuote(q.id);
    setEditing(null);
    setBookName(q.name);
    setDeal(q.deal);
    setDirty(false);
    setMsg({});
    setNaming(false);
    setRemoving(false);
    setQuoteError(null);
  }

  // From the empty card to the first field of the builder.
  function startEntering() {
    const el = document.getElementById('sub');
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }

  // A new deal starts empty: nothing on the card until the rep enters it.
  function newDeal() {
    setActiveQuote(null);
    setEditing(null);
    setBookName('');
    setBookedOn(calendar?.today ?? '');
    setDeal(EMPTY);
    setDirty(false);
    setMsg({});
    setNaming(false);
    setRemoving(false);
    setQuoteError(null);
  }

  async function saveQuote(asNew: boolean) {
    if (!onSaveQuote) return;
    setQuoteBusy(true);
    setQuoteError(null);
    let res: { error?: string; id?: string };
    try {
      // In the workspace the Deal name field names the quote too.
      const name = app ? bookName.trim() : asNew ? quoteName : (active?.name ?? '');
      res = await onSaveQuote({ id: asNew ? null : activeQuote, name, deal });
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setQuoteBusy(false);
    if (res.error) return setQuoteError(res.error);
    if (asNew) track('quote_saved', ctx);
    if (res.id) setActiveQuote(res.id);
    setDirty(false);
    setNaming(false);
    setQuoteName('');
    setMsg(asNew && app ? { quoted: true } : {});
  }

  // Close a quote straight from the list. Won books it today, under its
  // name, at its saved numbers; lost drops it. Either way, if it's the one
  // on the card, the card clears.
  async function quoteWon(q: Quote) {
    setQuoteBusy(true);
    setMsg({});
    let res: { error?: string };
    try {
      res = await onSave(q.deal, { name: q.name, bookedOn: calendar?.today });
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    if (!res.error && onDeleteQuote) {
      try {
        await onDeleteQuote(q.id);
      } catch {}
    }
    setQuoteBusy(false);
    if (res.error) return setMsg({ error: res.error });
    track('deal_booked', ctx);
    if (activeQuote === q.id) {
      setActiveQuote(null);
      setDeal(EMPTY);
      setDirty(false);
      setBookName('');
    }
    setMsg({ booked: true });
  }
  async function quoteLost(q: Quote) {
    if (!onDeleteQuote) return;
    setQuoteBusy(true);
    let res: { error?: string };
    try {
      res = await onDeleteQuote(q.id);
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setQuoteBusy(false);
    if (res.error) return setQuoteError(res.error);
    if (activeQuote === q.id) {
      setActiveQuote(null);
      setDeal(EMPTY);
      setDirty(false);
      setBookName('');
    }
  }

  async function removeQuote() {
    if (!activeQuote || !onDeleteQuote) return;
    setQuoteBusy(true);
    let res: { error?: string };
    try {
      res = await onDeleteQuote(activeQuote);
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setQuoteBusy(false);
    setRemoving(false);
    if (res.error) return setQuoteError(res.error);
    // The deal stays on the card, unsaved, to book or save again.
    setActiveQuote(null);
    setDirty(true);
  }

  // On the sample: put the whole sample back. On your own plan: an open quote
  // goes back to how it was saved, anything else to an empty deal. Your plan
  // and booked deals stay.
  function startOver() {
    if (editing) setDeal(editing.deal);
    else if (active) setDeal(active.deal);
    else setDeal(showcase ? SAMPLE : EMPTY);
    setDirty(false);
    setMsg({});
  }

  const { r } = o;
  // The commission's base is in the figure's own caption; months_of_mrr
  // plans have no such base to fold in, so New ARR stays here for them.
  const rows: LedgerRow[] = [
    ...(plan.commission_style === 'months_of_mrr'
      ? [
          {
            label: 'New ARR',
            value: <TweenedMoney value={r.subAnnual} />,
            suffix: r.subAnnualList !== r.subAnnual ? `· ${fmtMoney(r.subAnnualList)} at list` : undefined,
          },
        ]
      : []),
    {
      label: `Lands the ${noun} at`,
      value: plan.quota_basis === 'units' ? fmtCredit(plan, r.creditAfter) : <TweenedMoney value={r.creditAfter} />,
    },
    ...(r.customerSavesAnnual > 0
      ? [{ label: 'Customer saves', value: <TweenedMoney value={r.customerSavesAnnual} />, suffix: 'a year' }]
      : []),
  ];

  const [lead, rest] = leadSentence(copy.sentence);
  const accelMoment = o.state === 'crossed' || o.state === 'past';

  const app = variant === 'app';
  // The card rides beside the fields and the booked deals. Taller than the
  // window, it scrolls until its bottom shows, then holds there (a sticky
  // top that's negative by the overhang); shorter, it holds under the bar.
  useEffect(() => {
    if (!app) return;
    const inner = document.querySelector<HTMLElement>('.ds.is-app .ds-aside-inner');
    if (!inner) return;
    const place = () => {
      inner.style.setProperty('--stick', `${Math.min(72, window.innerHeight - inner.offsetHeight - 16)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(inner);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [app]);
  // In the workspace, a quote opened on a phone has its card below the list:
  // bring it into view (on a wide screen it's already beside it). A new deal
  // goes straight to its first field.
  function openFromRail(q: Quote) {
    openQuote(q);
    if (!app) return;
    requestAnimationFrame(() => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('deal-card')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    });
  }
  // A booked deal back in the card, to change it.
  function editDeal(row: DealRow) {
    const d = dealFromRow(row);
    setActiveQuote(null);
    setEditing({ id: row.id, deal: d, row });
    setBookName(row.name);
    setBookedOn(localDay(row.created_at));
    setDeal(d);
    setDirty(false);
    setMsg({});
    setNaming(false);
    setRemoving(false);
    setQuoteError(null);
    requestAnimationFrame(() => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('deal-card')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    });
  }
  // A closed deal's numbers as a new deal: the next location of the same
  // group, the same package to a new account. Name selected to retype.
  function copyDeal(row: DealRow) {
    setActiveQuote(null);
    setEditing(null);
    setBookName(row.name);
    setBookedOn(calendar?.today ?? '');
    setDeal(dealFromRow(row));
    setDirty(true);
    setMsg({});
    setNaming(false);
    setRemoving(false);
    setQuoteError(null);
    requestAnimationFrame(() => {
      const el = document.getElementById('dealName') as HTMLInputElement | null;
      el?.focus({ preventScroll: true });
      el?.select();
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    });
  }
  function newFromHead() {
    newDeal();
    requestAnimationFrame(startEntering);
  }
  const rail = quotesOn ? (
    <QuotesRail
      plan={plan}
      ptd={ptdIn}
      qtd={qtdIn ?? null}
      quotes={quotes}
      activeId={active?.id ?? null}
      onOpen={openFromRail}
      onNew={newDeal}
      compact={app}
      onWon={app ? (q) => void quoteWon(q) : undefined}
      onLost={app ? (q) => void quoteLost(q) : undefined}
      busy={quoteBusy}
    />
  ) : null;

  const introBlock = intro ?? <div className="ds-title">{rail}</div>;
  const afterNode = typeof after === 'function' ? after({ editDeal, copyDeal, editingId: editing?.id ?? null }) : after;
  // Nothing in the pipeline yet: the workspace drops its empty first column.
  const noRail = app && quotes.length === 0;

  const slider = (
    <DiscountSlider
      size="lg"
      id="subD"
      label={app ? 'Subscription discount' : 'Discount on the subscription'}
      value={deal.subscriptionDiscountPct}
      onChange={(v) => {
        if (showcase) show.takeOver();
        set('subscriptionDiscountPct', v);
        trackOnce('slider_drag', ctx);
      }}
      costsYou={subCost}
      valueText={`${fmtPctShort(deal.subscriptionDiscountPct)} off${subCost > 0 ? `, costs you ${fmtMoney(subCost)}` : ''}${xCopy?.tone === 'red' ? `. ${xCopy.label}` : ''}`}
      caption={
        !showcase || show.beat === 'free'
          ? sliderCaption(deal, r)
          : show.beat === 'done' && script
            ? customerSide(script)
            : undefined
      }
      aside={
        // On the landing card the line is always there, just invisible at
        // $0, so the slider never jumps down when the first cost appears.
        // In the workspace, a loss already leads the card as "Commission left
        // on the table": the same figure here would only repeat it.
        // In the workspace, the card leads with what the discounts left on
        // the table: the slider doesn't repeat it.
        (o.atStake > 0 || showcase) && !empty && !app ? (
          <p className={`slider-cost${o.atStake > 0 ? '' : ' is-zero'}`} aria-hidden={o.atStake > 0 ? undefined : true}>
            {showcase ? 'Costs you' : 'This deal’s discounts cost you'}{' '}
            <b>
              <TweenedMoney value={o.atStake} />
            </b>
          </p>
        ) : null
      }
      disabled={empty || r.subMrrList <= 0}
      kickerBreakpointPct={kickerCrossPct ?? accelLinePct}
      costsATier={Boolean(xEffect?.costsATier) || (lineKind === 'accelerator' && o.state === 'blocked')}
      lineKind={lineKind}
      holdAt={holdAt}
      hint={showcase ? show.hint : ''}
      // On a deal that crosses either way, "Try 0%" argues with the line.
      zeroPrompt={!showcase && lineKind !== 'accelerator'}
    />
  );

  return (
    <>
      {top?.({ onNew: newFromHead })}
      <section className={`ds${demo ? ' is-demo' : ''}${showcase ? ' is-showcase' : ''}${app ? ' is-app' : ''}${noRail ? ' no-rail' : ''}${app && empty && !(msg.booked || msg.updated || msg.quoted || msg.error) ? ' is-empty' : ''}`} aria-label="Deal">
        <div className="ds-grid">
          {app ? (
            !noRail && <div className="ds-rail">{rail}</div>
          ) : (
            <>
              <div className="ds-intro">{introBlock}</div>
              <div className="ds-block" aria-hidden="true">
                <span className="ds-block-ring" />
                <span className="ds-block-ring is-two" />
              </div>
              {!showcase && <div className="ds-panel" aria-hidden="true" />}
            </>
          )}

          <div className="ds-aside">
            <div className="ds-aside-inner">
            <article className="deal-card" id="deal-card" aria-labelledby="outcome-h" aria-busy={show.playing || undefined}>
              {/* In the workspace the page head already says the period: the card
                  only names what's on it, an open quote or a booked deal. */}
              {(!app || active || editing) && (
              <header className="dc-head">
                {showcase && (
                  <p className="dc-note">
                    <b>Sample deal.</b> Real math on made-up numbers.
                  </p>
                )}
                {editing ? (
                  <p className="dc-note">
                    Changing <b>{bookName.trim() || 'a booked deal'}</b> ·{' '}
                    <button type="button" className="btn-text" onClick={newDeal}>
                      Cancel
                    </button>
                  </p>
                ) : active ? (
                  <p className="dc-note">
                    <b>{quoteLabel(active)}</b> · open quote ·{' '}
                    {removing ? (
                      <>
                        Remove it?{' '}
                        <button type="button" className="btn-text" disabled={quoteBusy} onClick={removeQuote}>
                          Remove
                        </button>{' '}
                        <button type="button" className="btn-text" onClick={() => setRemoving(false)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn-text" onClick={() => setRemoving(true)}>
                        Remove
                      </button>
                    )}
                  </p>
                ) : (
                  <>
                    {!demo && (
                      <p className="dc-note">
                        <b>{plan.role_name}</b> · {label}
                      </p>
                    )}
                  </>
                )}
                {showcase && (show.beat === 'done' || show.beat === 'free') ? (
                  <button type="button" className="dc-replay" onClick={() => void show.play()}>
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Replay
                  </button>
                ) : (
                  !app && (
                    <span className="live-pill">
                      <i aria-hidden="true" />
                      Live
                    </span>
                  )
                )}
              </header>
              )}

              <div className="dc-body">
                {showcase && script && (
                  <div className="dc-sec">
                    <Narration beat={show.beat} crossed={crossed} s={script} />
                  </div>
                )}

                {empty && !showcase && app ? null : empty && !showcase ? (
                  <div className="dc-sec dc-start">
                    <p className="dc-start-label">
                      <span className="sq sq-pays" aria-hidden="true" />
                      New deal
                    </p>
                    <h2 id="outcome-h" className="dc-start-h">
                      What are you about to quote?
                    </h2>
                    <p className="dc-start-p">
                      {app
                        ? 'Enter the subscription and any one-time products and services. This shows what the deal pays you and what each point of discount costs.'
                        : 'Put in the subscription and any one-time products and services. This card shows what the deal pays you, what each point of discount costs, and where your accelerator and bonus lines are.'}
                    </p>
                    <button type="button" className={`btn ${app ? 'btn-secondary' : 'btn-primary'}`} onClick={startEntering}>
                      {app ? 'Enter the subscription' : 'Start with the subscription'} <span aria-hidden="true">&darr;</span>
                    </button>
                  </div>
                ) : app ? (
                  <div className="dc-sec">
                    <DealResult plan={plan} deal={deal} ptd={ptd} o={o} copy={copy} kicker={xCopy} slider={slider} facts={rows} />
                  </div>
                ) : (
                  <>
                    <div className="dc-sec">
                      {/* The landing card's story is the bonus line; the commission's
                          own arithmetic would only push the bonus below the fold. */}
                      <Outcome copy={showcase ? { ...copy, caption: null } : copy} state={o.state} />
                    </div>

                    <div className="dc-sec">
                      {slider}
                      {showcase && <KickerOutcome copy={xCopy} compact />}
                    </div>
                  </>
                )}

                {!showcase && !empty && !app && (
                  <div className="dc-sec">
                    <div className={`dc-sentence${accelMoment ? ' has-icon' : ''}`}>
                      {accelMoment && (
                        <span className="dc-icon" aria-hidden="true">
                          <svg viewBox="0 0 20 20" fill="none">
                            <path
                              d="M3 15.5h3.2v-4H9.4v-3.5h3.2V4.5H17"
                              stroke="currentColor"
                              strokeWidth="2.1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}
                      <p>
                        <b>{lead}</b>
                        {rest && ` ${rest}`}
                      </p>
                    </div>
                    <KickerOutcome copy={xCopy} />
                    {/* The workspace's numbers strip already says where the quarter stands. */}
                    {groundingDetail && !app && <p className="dc-quarter">{groundingDetail}</p>}
                  </div>
                )}

                {!showcase && (!empty || naming || Boolean(msg.booked || msg.updated || msg.quoted || msg.error || quoteError)) && (
                <div className="dc-sec">
                  {copy.detail && !app && <p className="dc-detail">{copy.detail}</p>}
                  {!empty && !app && <Ledger className="dc-ledger" rows={rows} />}
                  {naming ? (
                    <div className="quote-naming">
                      <label className="field-label" htmlFor="quote-name">
                        Name this quote
                      </label>
                      <div className="quote-naming-row">
                        <div className="field-box">
                          <input
                            id="quote-name"
                            className="field-input"
                            maxLength={80}
                            placeholder="Optional, like Q4 expansion"
                            value={quoteName}
                            autoFocus
                            onChange={(e) => setQuoteName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveQuote(true);
                              if (e.key === 'Escape') setNaming(false);
                            }}
                          />
                        </div>
                        <button type="button" className="btn btn-primary" disabled={quoteBusy} onClick={() => void saveQuote(true)}>
                          {quoteBusy ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                      <button type="button" className="btn-text quote-naming-cancel" onClick={() => setNaming(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    !empty && (
                    <>
                    {app && (
                      <div className="book-meta">
                        <label className="field">
                          <span className="field-label">Date Closed Won</span>
                          <input
                            className="field-input"
                            type="date"
                            min={calendar?.periodStart}
                            max={calendar?.today}
                            value={bookedOn}
                            onChange={(e) => setBookedOn(e.target.value)}
                          />
                        </label>
                      </div>
                    )}
                    <div className={`book-row${quotesOn && !editing ? ' has-quote' : ''}`}>
                      {/* Encouragement only when there's nothing to warn about. */}
                      {dirty && !pending && !msg.booked && !msg.error && !isCostly && (
                        <span className="nudge-ring book-nudge-ring" aria-hidden="true" />
                      )}
                      {app && quotesOn && !editing ? (
                        // The habit: price it, save the quote you send, book it
                        // when it closes. A new deal's main step is the quote; an
                        // open quote's is closing it.
                        active ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={quoteBusy || !dirty}
                              onClick={() => void saveQuote(false)}
                            >
                              {quoteBusy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
                            </button>
                            <button type="button" className="btn btn-block btn-primary" disabled={pending || empty} onClick={book}>
                              {pending ? 'Booking…' : 'Closed won: book it'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-secondary" disabled={pending || empty} onClick={book}>
                              {pending ? 'Booking…' : 'Book as closed won'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-block btn-primary"
                              disabled={quoteBusy || empty}
                              onClick={() => void saveQuote(true)}
                            >
                              {quoteBusy ? 'Saving…' : 'Save quote'}
                            </button>
                          </>
                        )
                      ) : (
                        <>
                          {quotesOn && !editing && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={quoteBusy || empty || (active !== null && !dirty)}
                              onClick={() => (active ? void saveQuote(false) : setNaming(true))}
                            >
                              {active ? (quoteBusy ? 'Saving…' : dirty ? 'Save changes' : 'Saved') : 'Save as a quote'}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`btn btn-block ${showcase ? 'btn-secondary' : 'btn-primary'}`}
                            disabled={pending || empty}
                            onClick={book}
                          >
                            {editing ? (pending ? 'Saving…' : 'Save changes') : pending ? 'Booking…' : 'Book this deal'}
                          </button>
                        </>
                      )}
                    </div>
                    </>
                    )
                  )}

                  {quoteError && <p className="after is-error">{quoteError}</p>}
                  {msg.error && <p className="after is-error">{msg.error}</p>}
                  {msg.updated && <p className="after">Changes saved. Your numbers and booked deals include them.</p>}
                  {msg.quoted && <p className="after">Saved to your open quotes. When it closes, book it from there in one tap.</p>}
                  {msg.booked && (
                    <>
                      <p className="after">
                        Booked to {label}. Your numbers above and your booked deals below include it.
                      </p>
                    </>
                  )}
                </div>
                )}
              </div>

              {/* After the story, never between a verdict and the control that acts on it. */}
              {showcase && (
                <footer className="dc-promo">
                  <p>Every plan has a line like this. Put yours in and see where it is.</p>
                  <Link className="btn btn-sun" href="/signup">
                    Put your plan in
                  </Link>
                </footer>
              )}
            </article>

            {/* Empty, it would only repeat the standing above it; in the
                workspace, "Lands the quarter at" and the strip cover it. */}
            {!showcase && !empty && !app && (
              <div className="period-card">
                <p className="period-card-h">{noun === 'quarter' ? 'Quarter' : 'Month'} to date</p>
                <QuotaLine mode="deal" plan={plan} ptd={ptd} r={r} empty={empty} />
              </div>
            )}
            </div>
          </div>

          {!showcase && (
            <div className="ds-main">
              <DealForm
                plan={plan}
                ptd={ptd}
                deal={deal}
                set={set}
                compact={app}
                targets={targets}
                name={app ? bookName : undefined}
                onName={
                  app
                    ? (v) => {
                        setBookName(v);
                        setDirty(true);
                      }
                    : undefined
                }
                footer={
                  dirty || Boolean(msg.booked) ? (
                    <p className="deal-start-over">
                      <button type="button" className="btn btn-secondary deal-reset" onClick={startOver}>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {active && dirty ? 'Undo changes' : 'Clear this deal'}
                      </button>
                    </p>
                  ) : null
                }
              />
              {!app && afterNode}
            </div>
          )}

          {!showcase && (
            <PinnedOutcome
              targetId="outcome-figure"
              name={copy.name}
              figureText={copy.figureText}
              tone={copy.figureTone}
              hidden={copy.figure === null}
            />
          )}
          {app && afterNode && <div className="ds-after">{afterNode}</div>}
        </div>
      </section>
    </>
  );
}
