'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_PLAN, periodLabel, syntheticOpening, type CompPlan, type DealInput, type PeriodToDate, type QuarterToDate } from '@/lib/calc';
import { fmtCredit, fmtMoney, fmtPctShort, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import DealForm from '@/components/DealForm';
import Outcome from '@/components/Outcome';
import DiscountSlider from '@/components/DiscountSlider';
import Ledger, { type LedgerRow } from '@/components/Ledger';
import PinnedOutcome from '@/components/PinnedOutcome';
import TweenedMoney from '@/components/TweenedMoney';
import PlanDialog from '@/components/PlanDialog';
import KickerOutcome from '@/components/KickerOutcome';
import Sculpture from '@/components/Sculpture';
import {
  EMPTY,
  OPENING_PTD,
  SAMPLE,
  costOf,
  crossEffect,
  kickerCrossDiscountPct,
  kickerGroundingDetail,
  kickerOutcomeCopy,
  isEmpty,
  outcome,
  outcomeCopy,
  sliderCaption,
} from '@/components/opening';

/** Splits "This deal triggers your accelerator. Every deal after..." into a bold lead and the rest. */
function leadSentence(s: string): [string, string] {
  const i = s.indexOf('. ');
  return i > 0 ? [s.slice(0, i + 1), s.slice(i + 2)] : [s, ''];
}

/**
 * The deal page. Left: the intro (the landing hero in the demo, a title
 * signed in), then the deal builder on a panel that rises under the result.
 * Right: the result card on a sunflower block, then where the period stands.
 * Works against the browser store (demo) and the server actions (signed in)
 * alike.
 */
export default function DealStage({
  plan,
  ptd,
  qtd,
  demo,
  onSave,
  onSavePlan,
  onStartOver,
  initialDeal,
  intro,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  /** Only needed (and only fetched by callers) when plan.quarterly_kicker
   *  is set — the calendar-quarter aggregate the bonus card measures against. */
  qtd?: QuarterToDate | null;
  demo: boolean;
  onSave: (deal: DealInput) => Promise<{ error?: string }>;
  /** Demo only: swap in the visitor's own plan without leaving this page. */
  onSavePlan?: (plan: CompPlan) => Promise<{ error?: string }>;
  onStartOver?: () => void;
  initialDeal?: DealInput;
  /** Top-left content beside the result card. Defaults to a page title. */
  intro?: ReactNode;
}) {
  const [deal, setDeal] = useState<DealInput>(initialDeal ?? (demo ? SAMPLE : EMPTY));
  const [planOpen, setPlanOpen] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ booked?: boolean; error?: string }>({});
  // Captured at the moment of booking, before `deal` resets to EMPTY below —
  // the post-booking plan-bridge names this exact figure, and
  // `copy.figureText` stops being that number the instant the reset happens.
  const [bookedFigure, setBookedFigure] = useState<string | null>(null);

  // The header's "Put your plan in" works from any page — it links here with
  // ?plan=1 to open the same inline dialog. A client-side nav to the same
  // route updates searchParams without remounting this component, so this
  // has to react to the param on every value it takes, including the first.
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (demo && searchParams.get('plan') === '1') {
      // Syncing to an external signal (the URL) from a sibling route with
      // no other path to this component's state — the case the lint rule's
      // own guidance calls out as legitimate.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlanOpen(true);
      router.replace('/', { scroll: false });
    }
  }, [demo, searchParams, router]);

  // `deal` only reads `initialDeal` on the very first render, which can't yet
  // know what's in localStorage: a saved custom plan (SAMPLE is sized for the
  // stock plan, so swap in a starter shaped to this one), or bookings from an
  // earlier visit that pushed the stock demo past its scripted opening (SAMPLE's
  // fixed 20% one-time discount no longer tells its story, so start empty).
  // A ref latch, not just `!dirty`, so it can never fire again and clobber
  // startOver()/a later savePlan(), which set `deal` themselves.
  const caughtUpToSavedState = useRef(false);
  useEffect(() => {
    if (caughtUpToSavedState.current || !demo || dirty) return;
    const customPlan = JSON.stringify(plan) !== JSON.stringify(DEMO_PLAN);
    const driftedStockDemo = !customPlan && JSON.stringify(ptd) !== JSON.stringify(OPENING_PTD);
    if (!customPlan && !driftedStockDemo) return;
    caughtUpToSavedState.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeal(customPlan ? syntheticOpening(plan).starter : EMPTY);
  }, [demo, plan, ptd, dirty]);

  const o = useMemo(() => outcome(plan, deal, ptd), [plan, deal, ptd]);
  const copy = useMemo(() => outcomeCopy(plan, deal, o, ptd), [plan, deal, o, ptd]);
  // Independent of the accelerator's own outcome above — this deal can cross
  // the accelerator and cost a quarterly kicker tier at the same time. null
  // whenever the plan has no quarterly_kicker or qtd wasn't fetched.
  const xEffect = useMemo(() => (qtd ? crossEffect(plan, o, qtd) : null), [plan, o, qtd]);
  const xCopy = useMemo(() => kickerOutcomeCopy(plan, xEffect, qtd ?? null), [plan, xEffect, qtd]);
  // Where the tier is lost, not whether it currently is — positions the
  // slider's line. xEffect.costsATier at the live discount is still the only
  // thing that decides red vs. not.
  const kickerCrossPct = useMemo(() => kickerCrossDiscountPct(plan, o, qtd ?? null), [plan, o, qtd]);
  const groundingDetail = kickerGroundingDetail(plan, qtd ?? null);
  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const empty = isEmpty(deal);
  const subCost = costOf(plan, deal, ptd, 'subscriptionDiscountPct');
  // Anything red on screen — money left on the table without crossing, the
  // accelerator blocked, or a kicker tier lost. The book nudge reads as "go
  // ahead, click this", exactly wrong while the page says this costs you.
  const isCostly = copy.secondary?.tone === 'red' || xCopy?.tone === 'red';

  const set = <K extends keyof DealInput>(k: K, v: DealInput[K]) => {
    setDeal((d) => ({ ...d, [k]: v }));
    setDirty(true);
    setMsg((m) => (m.booked ? {} : m));
  };

  async function book() {
    setPending(true);
    setMsg({});
    // onSave is a server action call — a network failure or timeout rejects
    // rather than resolving to {error}, which would leave pending stuck.
    let res: { error?: string };
    try {
      res = await onSave(deal);
    } catch {
      setPending(false);
      setMsg({ error: 'Could not reach the server. Check your connection and try again.' });
      return;
    }
    setPending(false);
    if (res.error) {
      setMsg({ error: res.error });
    } else {
      setBookedFigure(copy.figureText || null);
      setMsg({ booked: true });
      setDeal(EMPTY);
      setDirty(false);
    }
  }

  function startOver() {
    onStartOver?.();
    setDeal(SAMPLE);
    setDirty(false);
    setMsg({});
    // onStartOver puts the stock demo plan back, so "Your plan is in" must go too.
    setPlanSaved(false);
  }

  // Swapping in a real plan leaves the sample deal's numbers behind too —
  // they were sized for the sample plan's quota, not this one.
  async function savePlan(p: CompPlan) {
    const res = await onSavePlan!(p);
    if (!res.error) {
      setPlanOpen(false);
      // A deal sized to close the gap to your own accelerator, the same
      // "one deal from crossing" moment the sample opens on.
      setDeal(syntheticOpening(p).starter);
      setDirty(false);
      setMsg({});
      setPlanSaved(true);
    }
    return res;
  }

  const changed =
    dirty ||
    Boolean(msg.booked) ||
    JSON.stringify(ptd) !== JSON.stringify(OPENING_PTD) ||
    JSON.stringify(plan) !== JSON.stringify(DEMO_PLAN);

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
  const showPromoLive = demo && !planSaved && !msg.booked && !empty;
  const showPromoBooked = demo && !planSaved && Boolean(msg.booked) && Boolean(bookedFigure);

  const introBlock = intro ?? (
    <div className="ds-title">
      <h1 className="page-title">New deal · {label}</h1>
      <p className="ds-title-sub">Drag the discount before you quote it. Book it when it&rsquo;s right.</p>
    </div>
  );

  return (
    <>
      <section className={`ds${demo ? ' is-demo' : ''}`} aria-label="Deal">
        <div className="ds-grid">
          <div className="ds-intro">{introBlock}</div>

          <div className="ds-block" aria-hidden="true">
            <span className="ds-block-ring" />
            <span className="ds-block-ring is-two" />
          </div>
          <div className="ds-panel" aria-hidden="true" />

          <div className="ds-aside">
            <Sculpture kind="chart" id="sc-hero" className="ds-sculpture" />
            <article className="deal-card" id="deal-card" aria-labelledby="outcome-h">
              <header className="dc-head">
                {demo && !planSaved && (
                  <p className="dc-note">
                    <b>This is a sample {noun}.</b> Try the numbers.
                  </p>
                )}
                {demo && planSaved && (
                  <p className="dc-note">
                    <b>Your plan is in.</b> Saved in this browser only.{' '}
                    <Link className="btn-text" href="/login">
                      Sign in to keep it &rarr;
                    </Link>
                  </p>
                )}
                {!demo && (
                  <p className="dc-note">
                    <b>{plan.role_name}</b> · {label}
                  </p>
                )}
                <span className="live-pill">
                  <i aria-hidden="true" />
                  Live
                </span>
              </header>

              <div className="dc-body">
                <div className="dc-sec">
                  <Outcome copy={copy} state={o.state} />
                </div>

                <div className="dc-sec">
                  <DiscountSlider
                    size="lg"
                    id="subD"
                    label="Discount on the subscription"
                    value={deal.subscriptionDiscountPct}
                    onChange={(v) => set('subscriptionDiscountPct', v)}
                    costsYou={subCost}
                    valueText={`${fmtPctShort(deal.subscriptionDiscountPct)} off${subCost > 0 ? `, costs you ${fmtMoney(subCost)}` : ''}${xCopy?.tone === 'red' ? `. ${xCopy.label}` : ''}`}
                    caption={sliderCaption(deal, r)}
                    aside={
                      o.atStake > 0 && !empty ? (
                        <p className="slider-cost">
                          This deal&rsquo;s discounts cost you{' '}
                          <b>
                            <TweenedMoney value={o.atStake} />
                          </b>
                        </p>
                      ) : null
                    }
                    disabled={empty || r.subMrrList <= 0}
                    kickerBreakpointPct={kickerCrossPct}
                    costsATier={Boolean(xEffect?.costsATier)}
                  />
                </div>

                {!empty && (
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
                    {groundingDetail && <p className="dc-quarter">{groundingDetail}</p>}
                  </div>
                )}

                <div className="dc-sec">
                  {copy.detail && <p className="dc-detail">{copy.detail}</p>}
                  {!empty && <Ledger className="dc-ledger" rows={rows} />}
                  <div className="book-row">
                    {/* Encouragement only when there's nothing to warn about. */}
                    {dirty && !pending && !msg.booked && !msg.error && !isCostly && (
                      <span className="nudge-ring book-nudge-ring" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      className={`btn btn-block ${demo ? 'btn-secondary' : 'btn-primary'}`}
                      disabled={pending || empty}
                      onClick={book}
                    >
                      {pending ? 'Booking…' : 'Book this deal'}
                    </button>
                  </div>

                  {msg.error && <p className="after is-error">{msg.error}</p>}
                  {msg.booked && (
                    <>
                      <p className="after">
                        Booked to {label}.{' '}
                        <Link className="btn-text stand-nudge" href="/quota">
                          <span className="stand-nudge-mark" aria-hidden="true">
                            <span className="nudge-ring stand-nudge-ring" />
                            <span className="stand-nudge-dot" />
                          </span>
                          See where you stand &rarr;
                        </Link>
                      </p>
                      {demo && (
                        <p className="after-note">
                          Saved in this browser only ·{' '}
                          <Link className="btn-text" href="/login">
                            Sign in to keep it &rarr;
                          </Link>
                          {' · '}
                          <Link className="btn-text" href="/history">
                            See it in your deals &rarr;
                          </Link>
                        </p>
                      )}
                    </>
                  )}
                  {!msg.booked && !msg.error && demo && dirty && (
                    <p className="after">
                      <Link className="btn-text" href="/login">
                        Sign in to keep it &rarr;
                      </Link>
                    </p>
                  )}
                </div>
              </div>

              {/* After the decision, never between a verdict and the button that acts on it. */}
              {(showPromoLive || showPromoBooked) && (
                <footer className="dc-promo">
                  <p>
                    {showPromoLive ? (
                      <>
                        <b>{copy.figureText}</b> on a sample plan. Put your own numbers in and every figure here becomes
                        real.
                      </>
                    ) : (
                      <>
                        <b>{bookedFigure}</b> was real math, on a sample plan. Put your own numbers in and watch this
                        become yours.
                      </>
                    )}
                  </p>
                  <button type="button" className="btn btn-sun" onClick={() => setPlanOpen(true)}>
                    Put your plan in
                  </button>
                </footer>
              )}
            </article>

            <div className="period-card">
              <p className="period-card-h">{noun === 'quarter' ? 'Quarter' : 'Month'} to date</p>
              <QuotaLine mode="deal" plan={plan} ptd={ptd} r={r} empty={empty} />
            </div>
          </div>

          <div className="ds-main">
            <DealForm
              plan={plan}
              ptd={ptd}
              deal={deal}
              set={set}
              footer={
                demo && changed ? (
                  <p className="deal-start-over">
                    <button type="button" className="btn-text" onClick={startOver}>
                      Start over
                    </button>
                  </p>
                ) : null
              }
            />
          </div>

          <PinnedOutcome
            targetId="outcome-figure"
            name={copy.name}
            figureText={copy.figureText}
            tone={copy.figureTone}
            hidden={copy.figure === null}
          />
        </div>
      </section>

      {demo && planOpen && onSavePlan && (
        <PlanDialog plan={plan} onSave={savePlan} onClose={() => setPlanOpen(false)} />
      )}
    </>
  );
}
