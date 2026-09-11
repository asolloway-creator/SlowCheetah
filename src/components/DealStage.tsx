'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DEMO_PLAN, periodLabel, syntheticOpening, type CompPlan, type DealInput, type PeriodToDate } from '@/lib/calc';
import { fmtCredit, fmtMoney, fmtPctShort, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import DealForm from '@/components/DealForm';
import Outcome from '@/components/Outcome';
import DiscountSlider from '@/components/DiscountSlider';
import Ledger, { type LedgerRow } from '@/components/Ledger';
import PinnedOutcome from '@/components/PinnedOutcome';
import TweenedMoney from '@/components/TweenedMoney';
import PlanDialog from '@/components/PlanDialog';
import {
  EMPTY,
  OPENING_PTD,
  SAMPLE,
  costOf,
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
  demo,
  onSave,
  onSavePlan,
  onStartOver,
  initialDeal,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  demo: boolean;
  onSave: (deal: DealInput) => Promise<{ error?: string }>;
  /** Demo only: swap in the visitor's own plan without leaving this page. */
  onSavePlan?: (plan: CompPlan) => Promise<{ error?: string }>;
  onStartOver?: () => void;
  initialDeal?: DealInput;
}) {
  const [deal, setDeal] = useState<DealInput>(initialDeal ?? (demo ? SAMPLE : EMPTY));
  const [planOpen, setPlanOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ booked?: boolean; error?: string }>({});
  const [open, setOpen] = useState(false);

  const o = useMemo(() => outcome(plan, deal, ptd), [plan, deal, ptd]);
  const copy = useMemo(() => outcomeCopy(plan, deal, o), [plan, deal, o]);
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
    }
    return res;
  }

  const changed =
    dirty ||
    Boolean(msg.booked) ||
    JSON.stringify(ptd) !== JSON.stringify(OPENING_PTD) ||
    JSON.stringify(plan) !== JSON.stringify(DEMO_PLAN);

  const { r } = o;
  // Commission on this deal is the outcome figure now (Outcome.tsx) — not
  // repeated here, so the ledger doesn't say the same number twice.
  const rows: LedgerRow[] = [
    plan.commission_style === 'percent'
      ? {
          label: 'Commissionable value',
          value: <TweenedMoney value={r.commissionable} />,
          suffix: r.commissionableFull !== r.commissionable ? `· ${fmtMoney(r.commissionableFull)} at list` : undefined,
        }
      : {
          label: 'New ARR',
          value: <TweenedMoney value={r.subAnnual} />,
          suffix: r.subAnnualList !== r.subAnnual ? `· ${fmtMoney(r.subAnnualList)} at list` : undefined,
        },
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
          {demo ? ` · sample ${noun}` : ''}
        </p>

        <QuotaLine mode="deal" plan={plan} ptd={ptd} r={r} />

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
                <p className="after">Booked to {label} — the line moved.</p>
                {demo && (
                  <p className="after-note">
                    Saved in this browser only ·{' '}
                    <Link className="btn-text" href="/login">
                      Sign in to keep it &rarr;
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

            {!empty && <Ledger className="money-ledger" rows={rows} />}
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

      {demo && (
        <div className="below">
          <button type="button" className="btn btn-primary" onClick={() => setPlanOpen(true)}>
            Put your plan in
          </button>
          <p>Thirty seconds, and it&rsquo;s your paycheck instead of this sample.</p>
          {changed && (
            <button type="button" className="btn-text" onClick={startOver}>
              Start over
            </button>
          )}
        </div>
      )}

      {demo && planOpen && onSavePlan && (
        <PlanDialog plan={plan} onSave={savePlan} onClose={() => setPlanOpen(false)} />
      )}
    </>
  );
}
