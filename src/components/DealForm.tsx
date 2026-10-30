'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { periodLabel, sellsEquipment, type CompPlan, type DealInput, type PeriodToDate } from '@/lib/calc';
import { fmtMoney, fmtPctShort, planSentence } from '@/lib/format';
import NumField from '@/components/NumField';
import DiscountField, { type DiscountMode } from '@/components/DiscountField';
import Segmented from '@/components/Segmented';
import DiscountSlider from '@/components/DiscountSlider';
import { costOf, hardwareCopy, oneTimeCopy } from '@/components/opening';
import type { Line, Targets } from '@/components/discounts';

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
  compact = false,
  targets,
  name,
  onName,
  nameFoot,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  deal: DealInput;
  set: Setter;
  footer?: ReactNode;
  /** In the product: a working label and the plan in one quiet line. */
  compact?: boolean;
  /** The rep's own discount targets: shown on each Discount field, and
   *  flagged, with what the extra points cost, when a discount goes past. */
  targets?: Targets;
  /** The deal's name, typed first (the workspace). */
  name?: string;
  onName?: (v: string) => void;
  /** Under the name: the account it belongs to. */
  nameFoot?: ReactNode;
}) {
  // How each line's discount is typed: a percent, or the price quoted.
  const [modes, setModes] = useState<Record<Line, DiscountMode>>({ software: 'pct', services: 'pct', hardware: 'pct' });
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
  const hw = sellsEquipment(plan);
  const hwAmount = deal.hardware ?? 0;
  const hwOff = deal.hardwareDiscountPct ?? 0;
  const hwCost = hw ? costOf(plan, deal, ptd, 'hardwareDiscountPct') : 0;
  // The one-time lines: Services (onboarding, setup, implementation,
  // training) and, when the rep sells it, Equipment (hardware, devices).
  // Without an Equipment line, every one-time charge goes in Services.
  const otName = 'Services';

  // A discount past the rep's own target: by how much, and what those
  // extra points cost them on this deal.
  type Key = 'subscriptionDiscountPct' | 'oneTimeDiscountPct' | 'hardwareDiscountPct';
  const over = (key: Key, line: Line) => {
    const v = deal[key] ?? 0;
    // The company's limit comes first: past it, the deal needs approval.
    const lim = plan.limits?.[line];
    const t = lim !== undefined && v > lim + 1e-9 ? lim : targets?.[line];
    const kind: 'limit' | 'target' = lim !== undefined && v > lim + 1e-9 ? 'limit' : 'target';
    if (t === undefined || !(v > t + 1e-9)) return null;
    const extra = Math.max(0, costOf(plan, deal, ptd, key) - costOf(plan, { ...deal, [key]: t }, ptd, key));
    return { kind, t, pts: Math.round((v - t) * 10) / 10, extra };
  };
  const targetHead = (line: Line) => {
    const t = targets?.[line];
    const lim = plan.limits?.[line];
    if (t === undefined && lim === undefined) return undefined;
    // One label: whichever binds first. A limit at or under the target is
    // the real ceiling; above it, the target is.
    const showLimit = lim !== undefined && (t === undefined || lim <= t);
    return (
      <span className="field-target">
        {showLimit ? (lim === 0 ? 'No discount allowed' : `Limit ${fmtPctShort(lim as number)}`) : `Target ${fmtPctShort(t as number)}`}
      </span>
    );
  };
  const overNote = (o: { kind: 'limit' | 'target'; t: number; pts: number; extra: number } | null) =>
    o &&
    (o.kind === 'limit' ? (
      <span className="deal-over">
        {o.t === 0 ? 'Your company doesn’t allow a discount here' : `Past your company’s ${fmtPctShort(o.t)} limit`}: this one needs approval
        {o.extra >= 0.005 && (
          <>
            , and it costs you <span className="is-red">{fmtMoney(o.extra)}</span>
          </>
        )}
        .
      </span>
    ) : (
      <span className="deal-over">
        {parseFloat(o.pts.toFixed(1))} {o.pts === 1 ? 'point' : 'points'} over your {fmtPctShort(o.t)} target
        {o.extra >= 0.005 && (
          <>
            : those points cost you <span className="is-red">{fmtMoney(o.extra)}</span>
          </>
        )}
        .
      </span>
    ));
  const subOver = over('subscriptionDiscountPct', 'software');
  const otOver = over('oneTimeDiscountPct', 'services');
  const hwOver = over('hardwareDiscountPct', 'hardware');

  const units = (
    <div className="deal-units">
      <NumField id="units" label="Units" value={deal.units} min={1} integer stepper onChange={(n) => set('units', n)} />
    </div>
  );

  const head = compact ? (
    <div className="deal-top">
      <h2 id="deal-h" className="app-label">
        Deal
      </h2>
      <p className="deal-plan-line">
        {planSentence(plan)} ·{' '}
        <Link className="btn-text" href="/plan">
          Your plan
        </Link>
      </p>
    </div>
  ) : null;

  return (
    <section className={`deal${compact ? ' is-compact' : ''}`} aria-labelledby="deal-h">
      {head ?? (
      <>
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
      </>
      )}

      {compact ? (
        // The workspace: each line is its amount and its discount, typed,
        // side by side. The card's slider follows whatever's typed here, and
        // dragging it fills these in, so there's one number either way.
        <div className="deal-rows">
          {onName && (
            <div className="deal-name">
              <label className="field-label" htmlFor="dealName">
                Deal name
              </label>
              <div className="field-box">
                <input
                  id="dealName"
                  className="field-input"
                  maxLength={80}
                  placeholder="Who is this for? Optional"
                  value={name ?? ''}
                  onChange={(e) => onName(e.target.value)}
                />
              </div>
              {nameFoot}
            </div>
          )}
          <div className={`deal-row${subOver ? ' is-over' : ''}`}>
            <NumField
              id="sub"
              label="Subscription"
              prefix="$"
              blankZero
              placeholder="0"
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
            <DiscountField
              id="subPct"
              list={deal.subscription}
              pct={deal.subscriptionDiscountPct}
              onPct={(n) => set('subscriptionDiscountPct', n)}
              mode={modes.software}
              onMode={(m) => setModes((x) => ({ ...x, software: m }))}
              target={targetHead('software')}
            />
            <p className="field-note deal-row-note">
              {derived}
              {overNote(subOver)}
            </p>
          </div>
          <div className={`deal-row${otOver ? ' is-over' : ''}`}>
            <NumField
              id="ot"
              label={otName}
              prefix="$"
              value={deal.oneTime}
              blankZero
              placeholder="0"
              onChange={(n) => set('oneTime', n)}
              head={<span className="field-hint">{hw ? 'One-time: onboarding, setup, implementation, training' : 'One-time charges: onboarding, setup, equipment'}</span>}
            />
            <DiscountField
              id="otPct"
              list={deal.oneTime}
              pct={deal.oneTimeDiscountPct}
              onPct={(n) => set('oneTimeDiscountPct', n)}
              mode={modes.services}
              onMode={(m) => setModes((x) => ({ ...x, services: m }))}
              target={targetHead('services')}
            />
            <p className="field-note deal-row-note">
              {otOver ? (
                overNote(otOver)
              ) : otCost > 0 ? (
                <>
                  {fmtPctShort(deal.oneTimeDiscountPct)} off services costs you{' '}
                  <span className="is-red">{fmtMoney(otCost)}</span>.
                </>
              ) : (
                oneTimeCopy(plan, deal, otCost)
              )}
            </p>
          </div>
          {hw && (
            <div className={`deal-row${hwOver ? ' is-over' : ''}`}>
              <NumField
                id="hw"
                label="Equipment"
                prefix="$"
                value={hwAmount}
                blankZero
                placeholder="0"
                onChange={(n) => set('hardware', n)}
                head={<span className="field-hint">One-time: hardware, devices</span>}
              />
              <DiscountField
                id="hwPct"
                list={hwAmount}
                pct={hwOff}
                onPct={(n) => set('hardwareDiscountPct', n)}
                mode={modes.hardware}
                onMode={(m) => setModes((x) => ({ ...x, hardware: m }))}
                target={targetHead('hardware')}
              />
              <p className="field-note deal-row-note">
                {hwOver ? (
                  overNote(hwOver)
                ) : hwCost > 0 ? (
                  <>
                    {fmtPctShort(hwOff)} off hardware costs you <span className="is-red">{fmtMoney(hwCost)}</span>.
                  </>
                ) : (
                  hardwareCopy(plan, deal, hwCost)
                )}
              </p>
            </div>
          )}
          {/* Units only change anything on a plan whose quota is units. */}
          {plan.quota_basis === 'units' && <div className="deal-row deal-row-units">{units}</div>}
        </div>
      ) : (
      <div className="deal-fields">
        <div className="deal-sub">
          <NumField
            id="sub"
            label="Subscription"
            prefix="$"
            blankZero
            placeholder="0"
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
              <NumField id="hw" label="Equipment" prefix="$" value={hwAmount} blankZero placeholder="0" onChange={(n) => set('hardware', n)} />
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
          <NumField id="ot" label={otName} prefix="$" value={deal.oneTime} blankZero placeholder="0" onChange={(n) => set('oneTime', n)} />
          <DiscountSlider
            size="sm"
            id="otD"
            label="Discount on services"
            value={deal.oneTimeDiscountPct}
            onChange={(v) => set('oneTimeDiscountPct', v)}
            costsYou={otCost}
            valueText={costText(deal.oneTimeDiscountPct, otCost)}
            disabled={deal.oneTime <= 0}
          />
          <p className="field-note">
            {otCost > 0 ? (
              <>
                {fmtPctShort(deal.oneTimeDiscountPct)} off services costs you{' '}
                <span className="is-red">{fmtMoney(otCost)}</span>.
              </>
            ) : (
              oneTimeCopy(plan, deal, otCost)
            )}
          </p>
        </div>
      </div>
      )}
      {footer}
    </section>
  );
}
