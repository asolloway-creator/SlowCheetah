'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_PLAN, periodLabel, syntheticOpening, type CompPlan, type DealInput, type PeriodToDate, type QuarterToDate } from '@/lib/calc';
import { fmt, fmtCredit, fmtMoney, fmtPctShort, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import DealForm from '@/components/DealForm';
import Outcome from '@/components/Outcome';
import DiscountSlider from '@/components/DiscountSlider';
import Ledger, { type LedgerRow } from '@/components/Ledger';
import PinnedOutcome from '@/components/PinnedOutcome';
import TweenedMoney from '@/components/TweenedMoney';
import PlanDialog from '@/components/PlanDialog';
import KickerOutcome from '@/components/KickerOutcome';
import { track, trackOnce, type TrackContext } from '@/lib/track';
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
  sample = true,
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
  /** Demo only: still on the stock sample plan (the store's own `seeded`
   *  flag), as opposed to a plan the visitor saved. Keeps sample-deal play
   *  out of real-usage analytics. */
  sample?: boolean;
}) {
  const [deal, setDeal] = useState<DealInput>(initialDeal ?? (demo ? SAMPLE : EMPTY));
  const [planOpen, setPlanOpen] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ booked?: boolean; error?: string }>({});

  // The landing page's card: the stock sample, before the visitor has a plan
  // of their own. No deal builder and no booking. The card plays its one
  // story by itself (useShowcase), then hands the slider over. The builder
  // arrives with their own plan, where its numbers mean something.
  const showcase = demo && sample && !planSaved;
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
  // know what's in localStorage. A saved custom plan needs a starter shaped to
  // it (SAMPLE is sized for the stock plan). The stock sample keeps SAMPLE even
  // after bookings: its story may land differently, but a live deal beats an
  // empty, greyed-out card, and the sample is re-seeded every visit anyway
  // (lib/demo.ts). A ref latch, not just `!dirty`, so it can never fire again
  // and clobber startOver()/a later savePlan(), which set `deal` themselves.
  const caughtUpToSavedState = useRef(false);
  useEffect(() => {
    if (caughtUpToSavedState.current || !demo || dirty) return;
    if (JSON.stringify(plan) === JSON.stringify(DEMO_PLAN)) return;
    caughtUpToSavedState.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeal(syntheticOpening(plan).starter);
  }, [demo, plan, dirty]);

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
  // Past a line, the most the discount can be and still keep what it's costing.
  const holdAt = useMemo(() => holdLinePct(plan, deal, ptd, qtd ?? null), [plan, deal, ptd, qtd]);
  const groundingDetail = kickerGroundingDetail(plan, qtd ?? null);
  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const empty = isEmpty(deal);
  const subCost = costOf(plan, deal, ptd, 'subscriptionDiscountPct');
  // Anything red on screen — money left on the table without crossing, the
  // accelerator blocked, or a kicker tier lost. The book nudge reads as "go
  // ahead, click this", exactly wrong while the page says this costs you.
  const isCostly = copy.secondary?.tone === 'red' || xCopy?.tone === 'red';

  const ctx: TrackContext = !demo ? 'account' : sample ? 'sample' : 'own';
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
      track('deal_booked', ctx);
      setMsg({ booked: true });
      setDeal(EMPTY);
      setDirty(false);
    }
  }

  // On the sample: put the whole sample back. On your own plan: only the deal
  // goes back to a fresh starter. Your plan and booked deals stay.
  const ownPlan = demo && (!sample || planSaved);
  function startOver() {
    if (ownPlan) {
      setDeal(syntheticOpening(plan).starter);
    } else {
      onStartOver?.();
      setDeal(SAMPLE);
      setPlanSaved(false);
    }
    setDirty(false);
    setMsg({});
  }

  // Swapping in a real plan leaves the sample deal's numbers behind too —
  // they were sized for the sample plan's quota, not this one.
  async function savePlan(p: CompPlan) {
    const res = await onSavePlan!(p);
    if (!res.error) {
      // The dialog stays open on its "saved" step and closes itself; the
      // deal behind it updates now. A deal sized to close the gap to your
      // own accelerator, the same "one deal from crossing" moment the
      // sample opens on.
      setDeal(syntheticOpening(p).starter);
      setDirty(false);
      setMsg({});
      setPlanSaved(true);
    }
    return res;
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

  const introBlock = intro ?? (
    <div className="ds-title">
      <h1 className="page-title">New deal · {label}</h1>
      <p className="ds-title-sub">Drag the discount before you quote it. Book it when it&rsquo;s right.</p>
    </div>
  );

  const slider = (
    <DiscountSlider
      size="lg"
      id="subD"
      label="Discount on the subscription"
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
        (o.atStake > 0 || showcase) && !empty ? (
          <p className={`slider-cost${o.atStake > 0 ? '' : ' is-zero'}`} aria-hidden={o.atStake > 0 ? undefined : true}>
            {showcase ? 'Costs you' : 'This deal’s discounts cost you'}{' '}
            <b>
              <TweenedMoney value={o.atStake} />
            </b>
          </p>
        ) : null
      }
      disabled={empty || r.subMrrList <= 0}
      kickerBreakpointPct={kickerCrossPct}
      costsATier={Boolean(xEffect?.costsATier)}
      holdAt={holdAt}
      hint={showcase ? show.hint : ''}
      zeroPrompt={!showcase}
    />
  );

  return (
    <>
      <section className={`ds${demo ? ' is-demo' : ''}${showcase ? ' is-showcase' : ''}`} aria-label="Deal">
        <div className="ds-grid">
          <div className="ds-intro">{introBlock}</div>

          <div className="ds-block" aria-hidden="true">
            <span className="ds-block-ring" />
            <span className="ds-block-ring is-two" />
          </div>
          {!showcase && <div className="ds-panel" aria-hidden="true" />}

          <div className="ds-aside">
            <div className="ds-aside-inner">
            <article className="deal-card" id="deal-card" aria-labelledby="outcome-h" aria-busy={show.playing || undefined}>
              <header className="dc-head">
                {showcase && (
                  <p className="dc-note">
                    <b>Sample deal.</b> Real math on made-up numbers.
                  </p>
                )}
                {demo && !showcase && (
                  <p className="dc-note">
                    <b>{planSaved ? 'Your plan is in.' : 'Your plan.'}</b>{' '}
                    <Link className="btn-text" href="/login">
                      Sign in to keep it on any device &rarr;
                    </Link>
                  </p>
                )}
                {!demo && (
                  <p className="dc-note">
                    <b>{plan.role_name}</b> · {label}
                  </p>
                )}
                {showcase && (show.beat === 'done' || show.beat === 'free') ? (
                  <button type="button" className="dc-replay" onClick={() => void show.play()}>
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Replay
                  </button>
                ) : (
                  <span className="live-pill">
                    <i aria-hidden="true" />
                    Live
                  </span>
                )}
              </header>

              <div className="dc-body">
                {showcase && script && (
                  <div className="dc-sec">
                    <Narration beat={show.beat} crossed={crossed} s={script} />
                  </div>
                )}

                <div className="dc-sec">
                  {/* The landing card's story is the bonus line; the commission's
                      own arithmetic would only push the bonus below the fold. */}
                  <Outcome copy={showcase ? { ...copy, caption: null } : copy} state={o.state} />
                </div>

                <div className="dc-sec">
                  {slider}
                  {showcase && <KickerOutcome copy={xCopy} compact />}
                </div>

                {!showcase && !empty && (
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

                {!showcase && (
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
                )}
              </div>

              {/* After the story, never between a verdict and the control that acts on it. */}
              {showcase && (
                <footer className="dc-promo">
                  <p>Every plan has a line like this. Put yours in and see where it is.</p>
                  <button type="button" className="btn btn-sun" onClick={() => setPlanOpen(true)}>
                    Put your plan in
                  </button>
                </footer>
              )}
            </article>

            {!showcase && (
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
                footer={
                  demo && (dirty || Boolean(msg.booked)) ? (
                    <p className="deal-start-over">
                      <button type="button" className="btn btn-secondary deal-reset" onClick={startOver}>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Reset this deal
                      </button>
                    </p>
                  ) : null
                }
              />
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
        </div>
      </section>

      {demo && planOpen && onSavePlan && (
        <PlanDialog onSave={savePlan} onClose={() => setPlanOpen(false)} />
      )}
    </>
  );
}
