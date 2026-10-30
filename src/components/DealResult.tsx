'use client';

import type { ReactNode } from 'react';
import type { CompPlan, DealInput, PeriodToDate } from '@/lib/calc';
import { sellsEquipment } from '@/lib/calc';
import { fmt, fmtMoney, fmtRatePct } from '@/lib/format';
import TweenedMoney from '@/components/TweenedMoney';
import Ledger, { type LedgerRow } from '@/components/Ledger';
import KickerOutcome from '@/components/KickerOutcome';
import { costOf, type KickerOutcomeCopy, type Outcome, type OutcomeCopy } from '@/components/opening';

/**
 * The deal's result in the workspace, built the same way as the month's
 * "Commission this month": what this deal pays and what its discounts give
 * away, side by side at the same weight. Under them, only when a line is in
 * play, one sentence on the accelerator (and the Quarterly Bonus card when
 * that's at stake); then the discount slider, and the two facts worth a
 * glance before quoting. The landing page's stage card is a different
 * component on purpose.
 */
export default function DealResult({
  plan,
  deal,
  ptd,
  o,
  copy,
  kicker,
  slider,
  facts,
}: {
  plan: CompPlan;
  deal: DealInput;
  ptd: PeriodToDate;
  o: Outcome;
  copy: OutcomeCopy;
  kicker: KickerOutcomeCopy | null;
  slider: ReactNode;
  facts: LedgerRow[];
}) {
  const { r } = o;
  const lost = Math.max(0, o.atStake);
  // What each line's discount costs on its own, for the line under the lost
  // figure. Measured the same way as the field notes in the form.
  const parts = [
    { label: 'Subscription', cost: costOf(plan, deal, ptd, 'subscriptionDiscountPct') },
    { label: 'Services', cost: costOf(plan, deal, ptd, 'oneTimeDiscountPct') },
    ...(sellsEquipment(plan) ? [{ label: 'Equipment', cost: costOf(plan, deal, ptd, 'hardwareDiscountPct') }] : []),
  ].filter((p) => p.cost >= 0.005);
  // Two discounts on one deal interact a little (together they can cost
  // more than each alone); scaled so the parts add up to the figure above.
  const partsSum = parts.reduce((n, p) => n + p.cost, 0);
  const scaled = partsSum > 0 ? parts.map((p) => ({ ...p, cost: (p.cost * lost) / partsSum })) : parts;
  // "On $21,152 at 11%": the base and the rate it's paid at, plainly.
  const rateNow = r.commissionable > 0 ? ((r.commissionEffective - r.hardwareCommission) / r.commissionable) * 100 : 0;
  const earnedNote =
    plan.commission_style === 'percent' && r.commissionable > 0
      ? `On ${fmt(r.commissionable)} at ${fmtRatePct(Math.round(rateNow * 100) / 100)}${r.hardwareCommission > 0 ? `, plus ${fmtMoney(r.hardwareCommission)} on hardware` : ''}`
      : copy.caption;

  // The one line about the accelerator, when this deal moves it.
  const sec = copy.secondary;
  let stake: { tone: 'good' | 'bad' | 'plain'; text: ReactNode } | null = null;
  if (o.state === 'crossed') {
    stake = {
      tone: 'good',
      text:
        sec && sec.tone === 'green' ? (
          <>
            <b>Crosses your accelerator:</b> +{fmtMoney(sec.value)} on deals you&rsquo;ve already closed.
            {sec.caption && <> {sec.caption.charAt(0).toUpperCase() + sec.caption.slice(1)}.</>}
          </>
        ) : (
          copy.sentence
        ),
    };
  } else if (o.state === 'blocked') {
    stake = { tone: 'bad', text: copy.sentence };
  } else if (o.state === 'past') {
    stake = { tone: 'plain', text: copy.sentence };
  }

  return (
    <div className="dr">
      <h2 id="outcome-h" className="app-label">
        Commission on this deal
      </h2>
      <div className="dr-two">
        <div className="dr-fig">
          <span className="dr-k">Earned</span>
          <span id="outcome-figure" className="dr-v is-earned">
            <TweenedMoney value={r.commissionEffective} />
          </span>
          {earnedNote && <span className="dr-c">{earnedNote}</span>}
        </div>
        <div className="dr-fig">
          <span className="dr-k">Left on the table</span>
          <span className={`dr-v ${lost >= 0.005 ? 'is-lost' : 'is-zero'}`}>
            <TweenedMoney value={lost} />
          </span>
          <span className="dr-c">
            {lost < 0.005
              ? 'Full price'
              : scaled.length > 1
                ? scaled.map((p) => `${p.label} ${fmtMoney(p.cost)}`).join(' · ')
                : scaled.length === 1
                  ? `All on ${scaled[0].label.toLowerCase()}`
                  : 'Where this discount leaves the accelerator'}
          </span>
        </div>
      </div>

      {stake && <p className={`dr-stake is-${stake.tone}`}>{stake.text}</p>}
      {kicker && (
        <div className="dr-kicker">
          <KickerOutcome copy={kicker} />
        </div>
      )}

      <div className="dr-slider">{slider}</div>
      <Ledger className="dr-facts" rows={facts} />
    </div>
  );
}
