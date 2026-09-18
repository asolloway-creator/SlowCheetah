'use client';

import type { CompPlan, DealInput, PeriodToDate } from '@/lib/calc';
import { fmtMoney, fmtPctShort } from '@/lib/format';
import NumField from '@/components/NumField';
import Segmented from '@/components/Segmented';
import DiscountSlider from '@/components/DiscountSlider';
import { costOf, dealSummary, oneTimeCopy } from '@/components/opening';

type Setter = <K extends keyof DealInput>(k: K, v: DealInput[K]) => void;

/**
 * The deal column. One DOM for every breakpoint: on desktop `.deal-more` is
 * `display: contents` and the grid orders the pairs; below 900px it becomes
 * the "Edit the deal" disclosure.
 */
export default function DealForm({
  plan,
  ptd,
  deal,
  set,
  open,
  onToggle,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  deal: DealInput;
  set: Setter;
  open: boolean;
  onToggle: () => void;
}) {
  const d = deal.subscriptionDiscountPct;
  const acv = deal.subMode === 'acv';
  const listAnnual = acv ? deal.subscription : deal.subscription * 12;
  const listMonthly = acv ? deal.subscription / 12 : deal.subscription;
  const derived =
    deal.subscription > 0
      ? acv
        ? `${fmtMoney(listMonthly)} a month at list${d > 0 ? ` · ${fmtMoney(listMonthly * (1 - d / 100))} after ${fmtPctShort(d)} off` : ''}`
        : `${fmtMoney(listAnnual)} a year at list${d > 0 ? ` · ${fmtMoney(listAnnual * (1 - d / 100))} after ${fmtPctShort(d)} off` : ''}`
      : 'Per month or per year — whichever your quote says.';

  const otCost = costOf(plan, deal, ptd, 'oneTimeDiscountPct');
  const costText = (pct: number, cost: number) =>
    `${fmtPctShort(pct)} off${cost > 0 ? ` — costs you ${fmtMoney(cost)}` : ' — costs you nothing'}`;

  return (
    <section className="deal" aria-labelledby="deal-h">
      <h2 id="deal-h" className="deal-h">
        Edit the deal
      </h2>

      {/* Mobile-only toggle (desktop hides it, see .deal-summary in
          globals.css) — its own label used to repeat "Edit the deal" a
          second time, directly under the heading above that now says the
          same thing. Just the live preview here instead. */}
      <button type="button" className="deal-summary" aria-expanded={open} aria-controls="deal-more" onClick={onToggle}>
        <span className="deal-summary-desc">{dealSummary(deal)}</span>
      </button>

      <div id="deal-more" className={`deal-more${open ? '' : ' is-collapsed'}`}>
        <div className="deal-sub">
          <NumField
            id="sub"
            label="Subscription"
            prefix="$"
            value={deal.subscription}
            onChange={(n) => set('subscription', n)}
            head={
              <Segmented
                label="Subscription is quoted"
                value={deal.subMode}
                options={[
                  ['mrr', 'per month'],
                  ['acv', 'per year'],
                ]}
                onChange={(v) => set('subMode', v)}
              />
            }
          />
          <p className="field-note">{derived}</p>
        </div>

        <div className="deal-units">
          <NumField id="units" label="Units" value={deal.units} min={1} integer onChange={(n) => set('units', n)} />
        </div>

        <div className="deal-ot">
          <NumField id="ot" label="One-time products" prefix="$" value={deal.oneTime} onChange={(n) => set('oneTime', n)} />
          <DiscountSlider
            size="sm"
            id="otD"
            label="Discount on one-time products"
            value={deal.oneTimeDiscountPct}
            onChange={(v) => set('oneTimeDiscountPct', v)}
            costsYou={otCost}
            valueText={costText(deal.oneTimeDiscountPct, otCost)}
            disabled={deal.oneTime <= 0}
          />
        </div>

        <p className="deal-note">{oneTimeCopy(plan, deal, otCost)}</p>
      </div>
    </section>
  );
}
