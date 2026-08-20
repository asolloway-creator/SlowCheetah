'use client';

import { useActionState, useMemo, useState } from 'react';
import { calc, type CompPlan, type DealInput, type MonthToDate } from '@/lib/calc';
import { fmt, fmtD, fmtP } from '@/lib/format';
import TweenedMoney from '@/components/TweenedMoney';
import DiscountSlider from '@/components/DiscountSlider';
import ProgressBar from '@/components/ProgressBar';
import { saveDeal, type SaveState } from './actions';

const EMPTY: DealInput = {
  oneTime: 0,
  implementation: 0,
  subscription: 0,
  subMode: 'mrr',
  units: 1,
  oneTimeDiscountPct: 0,
  implementationDiscountPct: 0,
  subscriptionDiscountPct: 0,
};

const initialSave: SaveState = { error: null, savedId: null };

function NumField({
  label,
  value,
  onChange,
  prefix,
  step = 1,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  step?: number;
  min?: number;
}) {
  // `draft` holds exactly what is typed, so intermediate strings like "" or
  // "12." survive. `emitted` is the last number this field pushed upward; when
  // the parent's value diverges from it the parent reset the form and the draft
  // resyncs. No effect needed for either.
  const [draft, setDraft] = useState(String(value));
  const [emitted, setEmitted] = useState(value);

  if (value !== emitted) {
    setEmitted(value);
    setDraft(String(value));
  }

  function handle(raw: string) {
    setDraft(raw);
    const n = parseFloat(raw);
    const next = isNaN(n) ? min : Math.max(min, n);
    setEmitted(next);
    onChange(next);
  }

  return (
    <div className="input-row">
      {prefix && <span className="prefix">{prefix}</span>}
      <input
        type="number"
        className="num"
        value={draft}
        step={step}
        min={min}
        onChange={(e) => handle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={label}
      />
    </div>
  );
}

export default function DealBuilder({
  plan,
  mtd,
}: {
  plan: CompPlan;
  mtd: MonthToDate;
}) {
  const [deal, setDeal] = useState<DealInput>(EMPTY);
  const [state, action, pending] = useActionState(saveDeal, initialSave);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  // Clear the form once per successful save. The server action revalidates, so
  // the fresh month-to-date position arrives as new props on its own.
  if (state.savedId && state.savedId !== lastSavedId) {
    setLastSavedId(state.savedId);
    setDeal(EMPTY);
  }

  const set = <K extends keyof DealInput>(k: K, v: DealInput[K]) =>
    setDeal((d) => ({ ...d, [k]: v }));

  const dc = useMemo(() => calc(plan, deal, mtd), [plan, deal, mtd]);

  const rateColor = dc.isAccelerated ? 'var(--green)' : 'var(--gold)';
  const fillPct = dc.fullCommission > 0 ? Math.max(0, Math.min(100, (dc.commission / dc.fullCommission) * 100)) : 100;
  const lossPct = 100 - fillPct;
  const unitBarColor = dc.isAccelerated
    ? 'var(--green)'
    : dc.unitPct >= 70
      ? 'var(--gold)'
      : 'var(--border-strong)';
  const arrBarColor =
    dc.arrPct !== null && dc.arrPct >= 100
      ? 'var(--green)'
      : dc.arrPct !== null && dc.arrPct >= 70
        ? 'var(--gold)'
        : 'var(--border-strong)';
  const empty = deal.oneTime === 0 && deal.implementation === 0 && deal.subscription === 0;

  return (
    <>
      {/* ── Context strip ─────────────────────────────────────────── */}
      <div className="context">
        <div className="ctx-field">
          <span className="label">Plan</span>
          <span className="ctx-value">{plan.role_name}</span>
        </div>
        <div className="ctx-field">
          <span className="label">Booked this month</span>
          <span className="ctx-value">
            {mtd.unitsBooked} / {plan.monthly_unit_quota} units
          </span>
        </div>
        <div className="rate-block">
          <span className="rate-num" style={{ color: rateColor }}>
            {fmtP(dc.rate)}
          </span>
          <div className="rate-side">
            <span className="rate-state" style={{ color: rateColor }}>
              {dc.isAccelerated ? 'ACCELERATED' : 'BASE RATE'}
            </span>
            <span className="rate-note">
              {dc.isAccelerated
                ? `base was ${fmtP(plan.base_rate)}`
                : `accelerates at ${plan.accelerator_threshold} units (${fmtP(plan.accelerator_rate)})`}
            </span>
          </div>
        </div>
      </div>

      <div className="cols">
        {/* ── Left: deal builder ──────────────────────────────────── */}
        <div>
          <div className="card">
            <div className="card-title">Deal builder</div>
            <div className="grid-in">
              <div className="field">
                <span className="label">One-time products</span>
                <NumField
                  label="One-time products"
                  value={deal.oneTime}
                  onChange={(n) => set('oneTime', n)}
                  prefix="$"
                  step={500}
                />
              </div>
              <div className="field">
                <span className="label">Implementation</span>
                <NumField
                  label="Implementation"
                  value={deal.implementation}
                  onChange={(n) => set('implementation', n)}
                  prefix="$"
                  step={100}
                />
              </div>
              <div className="field">
                <div className="field-head">
                  <span className="label">
                    {deal.subMode === 'acv' ? 'Subscription ACV / yr' : 'Subscription / mo'}
                  </span>
                  <div className="seg">
                    <button
                      type="button"
                      className={deal.subMode === 'mrr' ? 'on' : ''}
                      onClick={() => set('subMode', 'mrr')}
                    >
                      MRR
                    </button>
                    <button
                      type="button"
                      className={deal.subMode === 'acv' ? 'on' : ''}
                      onClick={() => set('subMode', 'acv')}
                    >
                      ACV
                    </button>
                  </div>
                </div>
                <NumField
                  label="Subscription"
                  value={deal.subscription}
                  onChange={(n) => set('subscription', n)}
                  prefix="$"
                  step={50}
                />
              </div>
              <div className="field">
                <span className="label">Units</span>
                <NumField
                  label="Units"
                  value={deal.units}
                  onChange={(n) => set('units', Math.max(1, Math.round(n)))}
                  min={1}
                />
              </div>
            </div>

            <div className="card-title" style={{ margin: '18px 0 12px' }}>
              Discounts
            </div>
            <DiscountSlider
              id="otD"
              label="One-time products"
              value={deal.oneTimeDiscountPct}
              baseAmount={deal.oneTime}
              onChange={(v) => set('oneTimeDiscountPct', v)}
            />
            <DiscountSlider
              id="implD"
              label="Implementation"
              value={deal.implementationDiscountPct}
              baseAmount={deal.implementation}
              onChange={(v) => set('implementationDiscountPct', v)}
            />
            <DiscountSlider
              id="subD"
              label="Subscription"
              value={deal.subscriptionDiscountPct}
              baseAmount={deal.subscription}
              onChange={(v) => set('subscriptionDiscountPct', v)}
            />
          </div>

          {/* ── Save ─────────────────────────────────────────────── */}
          <div className="card">
            <div className="card-title">Book it</div>
            {state.error && <div className="notice err">{state.error}</div>}
            {state.savedId && (
              <div className="notice ok">
                Deal saved. It&rsquo;s in your history and your quota position above has
                moved.
              </div>
            )}
            <div className="card-note" style={{ marginBottom: 14 }}>
              Saving records this deal against the current month. Commission is stored
              as earned at today&rsquo;s rate, so history stays accurate even after the
              accelerator kicks in.
            </div>
            <form action={action}>
              <input type="hidden" name="oneTime" value={deal.oneTime} />
              <input type="hidden" name="implementation" value={deal.implementation} />
              <input type="hidden" name="subscription" value={deal.subscription} />
              <input type="hidden" name="subMode" value={deal.subMode} />
              <input type="hidden" name="units" value={deal.units} />
              <input type="hidden" name="oneTimeDiscountPct" value={deal.oneTimeDiscountPct} />
              <input
                type="hidden"
                name="implementationDiscountPct"
                value={deal.implementationDiscountPct}
              />
              <input
                type="hidden"
                name="subscriptionDiscountPct"
                value={deal.subscriptionDiscountPct}
              />
              <button className="btn btn-primary btn-lg" type="submit" disabled={pending || empty}>
                {pending ? 'Saving…' : 'Save this deal'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right: results ──────────────────────────────────────── */}
        <div>
          <div className="card">
            <div className="card-title">Commission on this deal</div>
            <TweenedMoney value={dc.commission} className="result-hero" />
            <div className="result-hero-label">
              mapped to your plan, rate, and quota position
            </div>
            <div className="row">
              <span className="row-label">Full-price deal value</span>
              <span className="row-value">{fmt(dc.full)}</span>
            </div>
            {dc.hasDiscount && (
              <div className="row">
                <span className="row-label">Discounted deal value</span>
                <span className="row-value red">{fmt(dc.disc)}</span>
              </div>
            )}
            <div className="row">
              <span className="row-label">Commission rate</span>
              <span className={`row-value${dc.isAccelerated ? ' green' : ''}`}>
                {fmtP(dc.rate)}
              </span>
            </div>
            {dc.hasDiscount && (
              <div className="row">
                <span className="row-label">Customer saves</span>
                <span className="row-value">{fmt(dc.customerSaves)}</span>
              </div>
            )}
            <div className="row">
              <span className="row-label">Units after this deal</span>
              <span className="row-value">
                {dc.unitsAfter} / {plan.monthly_unit_quota}
              </span>
            </div>
            {dc.triggersAccelerator && (
              <div className="accel-note">
                This deal triggers your accelerator. Every deal after this one earns at{' '}
                {fmtP(plan.accelerator_rate)}.
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Hold the line</div>
            <div className="line-visual">
              <div className="line-track">
                <div className="line-fill" style={{ width: `${fillPct}%` }} />
                {lossPct > 0.2 && <div className="line-loss" style={{ width: `${lossPct}%` }} />}
                <div className="line-tick" />
              </div>
              <div className="line-caption">
                <span className="line-cap-item" style={{ color: 'var(--gold)' }}>
                  Yours
                </span>
                {lossPct > 0.2 && (
                  <span className="line-cap-item" style={{ color: 'var(--red)' }}>
                    Left on table
                  </span>
                )}
                <span className="line-cap-item" style={{ color: 'var(--text-3)' }}>
                  Your line
                </span>
              </div>
            </div>
            <div className="row">
              <span className="row-label">Full-price commission</span>
              <span className="row-value green">{fmtD(dc.fullCommission)}</span>
            </div>
            <div className="row">
              <span className="row-label">Discounted commission</span>
              <span className={`row-value${dc.hasDiscount ? ' red' : ''}`}>
                {fmtD(dc.commission)}
              </span>
            </div>
            <div className="row">
              <span className="row-label strong">Money left on table</span>
              <TweenedMoney value={dc.lost} className="row-value red big" />
            </div>
            {dc.hasDiscount ? (
              <div className="leaking">
                {fmtD(dc.lost)} comes out of your paycheck on this deal. The customer
                saves {fmt(dc.customerSaves)}, but you&rsquo;re the one paying for part
                of it.
              </div>
            ) : (
              <div className="holding">
                You&rsquo;re holding the line. Full commission, nothing left on the
                table.
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Quota position</div>
            <div className="tracker-row">
              <span className="label">Monthly unit quota</span>
              <div className="tracker-main">
                {dc.unitsAfter} / {plan.monthly_unit_quota} units
              </div>
              <ProgressBar pct={dc.unitPct} color={unitBarColor} />
              <div className="tracker-sub">
                {dc.isAccelerated ? (
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                    Accelerator active at {fmtP(plan.accelerator_rate)}
                  </span>
                ) : (
                  <span style={{ color: 'var(--gold)' }}>
                    {dc.unitsToAccelerator} deal{dc.unitsToAccelerator !== 1 ? 's' : ''} to
                    unlock {fmtP(plan.accelerator_rate)}
                  </span>
                )}
              </div>
            </div>
            <div className="tracker-row">
              <span className="label">New ARR pace</span>
              <div className="tracker-main">
                {fmt(dc.arrAfter)}
                {plan.monthly_arr_quota ? ` / ${fmt(plan.monthly_arr_quota)}` : ''}
              </div>
              {dc.arrPct !== null && <ProgressBar pct={dc.arrPct} color={arrBarColor} />}
              <div className="tracker-sub">
                Annualized new subscription revenue this month, after this deal.
                {dc.arrPct === null && ' Add an ARR quota on your comp plan to pace against a target.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
