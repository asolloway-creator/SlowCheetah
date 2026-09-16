'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_PLAN, periodLabel, syntheticOpening, type CompPlan, type DealInput, type PeriodToDate, type QuarterToDate } from '@/lib/calc';
import { fmtCredit, fmtMoney, fmtPctShort, periodNoun, planSentence } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import DealForm from '@/components/DealForm';
import Outcome from '@/components/Outcome';
import DiscountSlider from '@/components/DiscountSlider';
import Ledger, { type LedgerRow } from '@/components/Ledger';
import PinnedOutcome from '@/components/PinnedOutcome';
import TweenedMoney from '@/components/TweenedMoney';
import PlanDialog from '@/components/PlanDialog';
import KickerOutcome from '@/components/KickerOutcome';
import {
  EMPTY,
  OPENING_PTD,
  SAMPLE,
  costOf,
  crossEffect,
  kickerGroundingDetail,
  kickerOutcomeCopy,
  isEmpty,
  outcome,
  outcomeCopy,
  sliderCaption,
} from '@/components/opening';

/**
 * The stage: one object on a sheet of paper. The line runs across the top,
 * the deal sits on the left, the money on the right. Works against the
 * browser store (demo) and the server actions (signed in) alike.
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
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  /** Only needed (and only fetched by callers) when plan.quarterly_kicker
   *  is set — the calendar-quarter aggregate the cross-effect callout
   *  measures against. */
  qtd?: QuarterToDate | null;
  demo: boolean;
  onSave: (deal: DealInput) => Promise<{ error?: string }>;
  /** Demo only: swap in the visitor's own plan without leaving this page. */
  onSavePlan?: (plan: CompPlan) => Promise<{ error?: string }>;
  onStartOver?: () => void;
  initialDeal?: DealInput;
}) {
  const [deal, setDeal] = useState<DealInput>(initialDeal ?? (demo ? SAMPLE : EMPTY));
  const [planOpen, setPlanOpen] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ booked?: boolean; error?: string }>({});
  const [open, setOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);

  // The header's "Put your plan in" works from any page — it links here with
  // ?plan=1 to open the same inline dialog, instead of needing its own copy
  // of the plan form on every route. A client-side nav to the same route
  // (already on `/`) updates searchParams without remounting this
  // component, so this can't be a one-time initial-state read — it has to
  // react to the param on every value it takes, including the first.
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

  const o = useMemo(() => outcome(plan, deal, ptd), [plan, deal, ptd]);
  const copy = useMemo(() => outcomeCopy(plan, deal, o, ptd), [plan, deal, o, ptd]);
  // Independent of the accelerator's own outcome/copy above — this deal can
  // cross the accelerator and cost a quarterly kicker tier at the same
  // time. null whenever the plan has no quarterly_kicker or qtd wasn't
  // fetched (callers only fetch it when a kicker is actually configured).
  const xEffect = useMemo(() => (qtd ? crossEffect(plan, o, qtd) : null), [plan, o, qtd]);
  const xCopy = useMemo(() => kickerOutcomeCopy(plan, xEffect, qtd ?? null), [plan, xEffect, qtd]);
  const groundingDetail = kickerGroundingDetail(plan, qtd ?? null);
  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const empty = isEmpty(deal);
  const subCost = costOf(plan, deal, ptd, 'subscriptionDiscountPct');

  const set = <K extends keyof DealInput>(k: K, v: DealInput[K]) => {
    setDeal((d) => ({ ...d, [k]: v }));
    setDirty(true);
    setMsg((m) => (m.booked ? {} : m));
  };

  async function book() {
    setPending(true);
    setMsg({});
    const res = await onSave(deal);
    setPending(false);
    if (res.error) {
      setMsg({ error: res.error });
    } else {
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
  }

  // Swapping in a real plan leaves the sample deal's numbers behind too —
  // they were sized for the sample plan's quota, not this one.
  async function savePlan(p: CompPlan) {
    const res = await onSavePlan!(p);
    if (!res.error) {
      setPlanOpen(false);
      // A deal sized to close the gap to your own accelerator, not an
      // empty form — the same "one deal from crossing" moment the sample
      // opens on, generated from the numbers just entered.
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
  // Commission on this deal is the outcome figure now (Outcome.tsx), and its
  // commissionable base now lives in that figure's own caption (opening.ts)
  // — not repeated here, so the ledger doesn't say either number twice.
  // months_of_mrr plans have no such base to fold in, so New ARR stays.
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

  return (
    <>
      <section className="stage" aria-labelledby="stage-context">
        <p id="stage-context" className="stage-context">
          {plan.role_name} · {label}
        </p>
        <p className="stage-context">{planSentence(plan)}</p>
        {demo && !planSaved && (
          // "sample {noun}" used to be a quiet qualifier buried in the line
          // above — easy to read past without registering that none of this
          // is the visitor's own data. Its own line, own color, and the
          // actual next step named, not just implied by the header button.
          <p className="stage-sample-note">
            This is a sample {noun} — try the numbers below, then{' '}
            <Link className="btn-text" href="/?plan=1">
              put in your plan &rarr;
            </Link>
          </p>
        )}
        {demo && planSaved && (
          <p className="after-note stage-plan-saved">
            Your plan is in. Saved in this browser only ·{' '}
            <Link className="btn-text" href="/login">
              Sign in to keep it &rarr;
            </Link>
          </p>
        )}

        <QuotaLine mode="deal" plan={plan} ptd={ptd} r={r} empty={empty} />

        <div className="stage-grid">
          <DealForm plan={plan} ptd={ptd} deal={deal} set={set} open={open} onToggle={() => setOpen((v) => !v)} />

          <section className="money" aria-labelledby="outcome-h">
            <Outcome copy={copy} state={o.state}>
              <DiscountSlider
                size="lg"
                id="subD"
                label="Discount on the subscription"
                value={deal.subscriptionDiscountPct}
                onChange={(v) => set('subscriptionDiscountPct', v)}
                costsYou={subCost}
                valueText={`${fmtPctShort(deal.subscriptionDiscountPct)} off${subCost > 0 ? ` — costs you ${fmtMoney(subCost)}` : ''}`}
                caption={sliderCaption(deal, r)}
                disabled={empty || r.subMrrList <= 0}
              />
            </Outcome>

            <KickerOutcome copy={xCopy} />

            <div className="book-row">
              <button
                type="button"
                className={`btn ${demo ? 'btn-secondary' : 'btn-primary'}`}
                disabled={pending || empty}
                onClick={book}
              >
                {pending ? 'Booking…' : 'Book this deal'}
              </button>
            </div>

            {msg.error && <p className="after is-error">{msg.error}</p>}
            {msg.booked && (
              <>
                {/* "the line moved" is a claim about the accelerator bar — this
                    deal-page bar only ever shows progress relative to whatever's
                    in progress, so once the deal resets to empty it goes quiet
                    again. /quota draws the same line from zero instead, so this
                    is where "moved" actually reads as moved. Same link for demo
                    and signed-in; neither path offered it before. */}
                <p className="after">
                  Booked to {label} — the line moved.{' '}
                  <Link className="btn-text" href="/quota">
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

            {!empty && (
              <>
                <button
                  type="button"
                  className="math-summary"
                  aria-expanded={mathOpen}
                  aria-controls="math-more"
                  onClick={() => setMathOpen((v) => !v)}
                >
                  <span className="math-summary-title">See the math</span>
                </button>

                <div id="math-more" className={`math-more${mathOpen ? '' : ' is-collapsed'}`}>
                  {copy.detail && <p className="math-more-detail">{copy.detail}</p>}
                  {groundingDetail && <p className="math-more-detail">{groundingDetail}</p>}
                  <Ledger className="money-ledger" rows={rows} />
                </div>
              </>
            )}
          </section>
        </div>

        <PinnedOutcome
          targetId="outcome-figure"
          name={copy.name}
          figureText={copy.figureText}
          tone={copy.figureTone}
          hidden={copy.figure === null}
        />
      </section>

      {demo && changed && (
        <div className="below">
          <button type="button" className="btn-text" onClick={startOver}>
            Start over
          </button>
        </div>
      )}

      {demo && planOpen && onSavePlan && (
        <PlanDialog plan={plan} onSave={savePlan} onClose={() => setPlanOpen(false)} />
      )}
    </>
  );
}
