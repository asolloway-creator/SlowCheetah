'use client';

import type { ReactNode } from 'react';
import { paysHardware, periodLabel, type CompPlan, type DealInput, type PeriodToDate } from '@/lib/calc';
import { fmtMoney, fmtPctShort, planSentence } from '@/lib/format';
import NumField from '@/components/NumField';
import Segmented from '@/components/Segmented';
import DiscountSlider from '@/components/DiscountSlider';
import { costOf, hardwareCopy, oneTimeCopy } from '@/components/opening';

type Setter = <K extends keyof DealInput>(k: K, v: DealInput[K]) => void;

/** The deal builder: the plan it's measured against, then the inputs. A plan
 *  that pays hardware its own rate gets a hardware line of its own, beside
 *  setup and services. */
export default function DealForm({
  plan,
  ptd,
  deal,
  set,
  footer,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  deal: DealInput;
  set: Setter;
  footer?: ReactNode;
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
      : 'Per month or per year, whichever your quote says.';

  const otCost = costOf(plan, deal, ptd, 'oneTimeDiscountPct');
  const costText = (pct: number, cost: number) =>
    `${fmtPctShort(pct)} off, ${cost > 0 ? `costs you ${fmtMoney(cost)}` : 'costs you nothing'}`;
  const hw = paysHardware(plan);
  const hwAmount = deal.hardware ?? 0;
  const hwOff = deal.hardwareDiscountPct ?? 0;
  const hwCost = hw ? costOf(plan, deal, ptd, 'hardwareDiscountPct') : 0;
  const otName = hw ? 'Setup and services' : 'One-time products';

  const units = (
    <div className="deal-units">
      <NumField id="units" label="Units" value={deal.units} min={1} integer stepper onChange={(n) => set('units', n)} />
    </div>
  );

  return (
    <section className="deal" aria-labelledby="deal-h">
      <p className="eyebrow">
        <span className="mark-dot" aria-hidden="true" />
        The deal builder
      </p>
      <h2 id="deal-h" className="deal-h">
        Edit the deal
      </h2>
      <p className="deal-plan">
        <b>
          {plan.role_name || 'Rep'} · {periodLabel(plan.period)}.
        </b>{' '}
        Change any input and the result card moves with it.
      </p>
      <ul className="chips" aria-label="Your plan">
        {planSentence(plan)
          .split(' · ')
          .map((part) => (
            <li key={part}>{part}</li>
          ))}
      </ul>

      <div className="deal-fields">
        <div className="deal-sub">
          <NumField
            id="sub"
            label="Subscription"
            prefix="$"
            suffix={acv ? 'per year' : 'per month'}
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

        {hw ? (
          <div className="deal-col">
            {units}
            <div className="deal-hw">
              <NumField id="hw" label="Hardware" prefix="$" value={hwAmount} onChange={(n) => set('hardware', n)} />
              <DiscountSlider
                size="sm"
                id="hwD"
                label="Discount on hardware"
                value={hwOff}
                onChange={(v) => set('hardwareDiscountPct', v)}
                costsYou={hwCost}
                valueText={costText(hwOff, hwCost)}
                disabled={hwAmount <= 0}
              />
              <p className="field-note">
                {hwCost > 0 ? (
                  <>
                    {fmtPctShort(hwOff)} off hardware costs you <span className="is-red">{fmtMoney(hwCost)}</span>.
                  </>
                ) : (
                  hardwareCopy(plan, deal, hwCost)
                )}
              </p>
            </div>
          </div>
        ) : (
          units
        )}

        <div className="deal-ot">
          <NumField id="ot" label={otName} prefix="$" value={deal.oneTime} onChange={(n) => set('oneTime', n)} />
          <DiscountSlider
            size="sm"
            id="otD"
            label={`Discount on ${otName.toLowerCase()}`}
            value={deal.oneTimeDiscountPct}
            onChange={(v) => set('oneTimeDiscountPct', v)}
            costsYou={otCost}
            valueText={costText(deal.oneTimeDiscountPct, otCost)}
            disabled={deal.oneTime <= 0}
          />
          <p className="field-note">
            {otCost > 0 ? (
              <>
                {fmtPctShort(deal.oneTimeDiscountPct)} off {otName.toLowerCase()} costs you{' '}
                <span className="is-red">{fmtMoney(otCost)}</span>.
              </>
            ) : (
              oneTimeCopy(plan, deal, otCost)
            )}
          </p>
        </div>
      </div>
      {footer}
    </section>
  );
}
