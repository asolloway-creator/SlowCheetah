'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  calc,
  quarterLabel,
  ONBOARDING_PRICES,
  PACKAGE_LABELS,
  SIDE_DISH_PRICES,
  type CompPlan,
  type DealInput,
  type OnboardingPackage,
  type QuarterToDate,
} from '@/lib/calc';
import { fmt, fmtD } from '@/lib/format';
import TweenedMoney from '@/components/TweenedMoney';
import DiscountSlider from '@/components/DiscountSlider';
import ProgressBar from '@/components/ProgressBar';
import { saveDeal, type SaveState } from './actions';

const EMPTY: DealInput = {
  locations: 1,
  freepour: false,
  pkg: 'boost',
  saasDiscountPct: 0,
  sideDishes: { recipes: 0, qbo: false, commissary: false, invoiceBackMonths: 0 },
};

const initialSave: SaveState = { error: null, savedId: null };
const PACKAGES: OnboardingPackage[] = ['launch', 'boost', 'accelerate'];

function NumField({
  label,
  value,
  onChange,
  min = 0,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [emitted, setEmitted] = useState(value);

  if (value !== emitted) {
    setEmitted(value);
    setDraft(String(value));
  }

  function handle(raw: string) {
    setDraft(raw);
    const n = parseInt(raw, 10);
    const next = isNaN(n) ? min : Math.max(min, n);
    setEmitted(next);
    onChange(next);
  }

  return (
    <div className="input-row">
      <input
        type="number"
        className="num"
        value={draft}
        step={1}
        min={min}
        onChange={(e) => handle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={label}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

function Toggle({
  on,
  label,
  desc,
  onChange,
}: {
  on: boolean;
  label: string;
  desc: React.ReactNode;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div style={{ flex: 1 }}>
        <span className="toggle-name">{label}</span>
        <span className={`toggle-desc${on ? ' active' : ''}`}>{desc}</span>
      </div>
      <button
        type="button"
        className={`toggle${on ? ' on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

export default function DealBuilder({
  plan,
  qtd,
}: {
  plan: CompPlan;
  qtd: QuarterToDate;
}) {
  const [deal, setDeal] = useState<DealInput>(EMPTY);
  const [sidesOpen, setSidesOpen] = useState(false);
  const [state, action, pending] = useActionState(saveDeal, initialSave);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  // Clear the form once per successful save; fresh quarter data arrives as props.
  if (state.savedId && state.savedId !== lastSavedId) {
    setLastSavedId(state.savedId);
    setDeal(EMPTY);
  }

  const set = <K extends keyof DealInput>(k: K, v: DealInput[K]) =>
    setDeal((d) => ({ ...d, [k]: v }));
  const setSide = <K extends keyof DealInput['sideDishes']>(k: K, v: DealInput['sideDishes'][K]) =>
    setDeal((d) => ({ ...d, sideDishes: { ...d.sideDishes, [k]: v } }));

  const r = useMemo(() => calc(plan, deal, qtd), [plan, deal, qtd]);
  const q = quarterLabel();

  const fillPct =
    r.commissionFullBase > 0
      ? Math.max(0, Math.min(100, (r.commissionBase / r.commissionFullBase) * 100))
      : 100;
  const lossPct = 100 - fillPct;
  const quotaBarColor = r.isAccelerated
    ? 'var(--green)'
    : r.quotaPct >= 70
      ? 'var(--accent)'
      : 'var(--steel)';

  return (
    <>
      {/* ── Context strip ─────────────────────────────────────────── */}
      <div className="context">
        <div className="ctx-field">
          <span className="label">Plan</span>
          <span className="ctx-value">{plan.role_name}</span>
        </div>
        <div className="ctx-field">
          <span className="label">{q} ARR booked</span>
          <span className="ctx-value">
            {fmt(qtd.arrBooked)} / {fmt(plan.quarterly_arr_quota)}
          </span>
        </div>
        <div className="rate-block">
          {r.wasAccelerated ? (
            <>
              <span className="rate-num" style={{ color: 'var(--green)' }}>
                +{plan.accelerator_pct}%
              </span>
              <div className="rate-side">
                <span className="rate-state" style={{ color: 'var(--green)' }}>ACCELERATED</span>
                <span className="rate-note">every deal this quarter earns the bump</span>
              </div>
            </>
          ) : (
            <>
              <span className="rate-num" style={{ color: 'var(--accent)' }}>
                {fmt(Math.max(0, plan.quarterly_arr_quota - qtd.arrBooked))}
              </span>
              <div className="rate-side">
                <span className="rate-state" style={{ color: 'var(--accent)' }}>ARR TO QUOTA</span>
                <span className="rate-note">
                  crossing unlocks +{plan.accelerator_pct}% on the whole quarter
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="cols">
        {/* ── Left: deal builder ──────────────────────────────────── */}
        <div>
          <div className="card">
            <div className="card-title">Deal builder</div>

            <div className="grid-in">
              <div className="field">
                <span className="label">Locations</span>
                <NumField
                  label="Locations"
                  value={deal.locations}
                  onChange={(n) => set('locations', n)}
                  min={1}
                />
              </div>
              <div className="field">
                <span className="label">Monthly SaaS per location</span>
                <div className="ctx-value" style={{ paddingTop: 8 }}>
                  {fmt(r.mrrPerLocation)}
                  <span className="muted"> /mo</span>
                </div>
              </div>
            </div>

            <Toggle
              on={deal.freepour}
              label="Freepour Smart Scale"
              desc={
                deal.freepour
                  ? `Attached to all ${deal.locations} location${deal.locations !== 1 ? 's' : ''} — +${fmt(plan.freepour_mrr)}/mo each`
                  : `+${fmt(plan.freepour_mrr)}/mo per location. Attaches to every location on the deal, or none.`
              }
              onChange={(v) => set('freepour', v)}
            />

            <div className="card-title" style={{ margin: '18px 0 12px' }}>Onboarding package</div>
            <div className="pkg-grid">
              {PACKAGES.map((p) => {
                const price = ONBOARDING_PRICES[p];
                const on = deal.pkg === p;
                return (
                  <button
                    key={p}
                    type="button"
                    className={`pkg${on ? ' on' : ''}`}
                    onClick={() => set('pkg', p)}
                  >
                    <span className="pkg-name">{PACKAGE_LABELS[p]}</span>
                    <span className="pkg-price">
                      {fmt(price.first)}
                      <span className="muted"> first loc</span>
                    </span>
                    <span className="pkg-sub">+{fmt(price.additional)} per add&rsquo;l</span>
                  </button>
                );
              })}
            </div>

            <div className="card-title" style={{ margin: '18px 0 12px' }}>Discount</div>
            <DiscountSlider
              id="saasD"
              label="SaaS discount"
              value={deal.saasDiscountPct}
              baseAmount={r.mrrList}
              onChange={(v) => set('saasDiscountPct', v)}
            />
          </div>

          {/* ── Side dishes ─────────────────────────────────────── */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Side dishes</div>
              <button className="pq-toggle" type="button" onClick={() => setSidesOpen(!sidesOpen)}>
                <span className={`pq-arrow${sidesOpen ? ' open' : ''}`}>&#9654;</span>
                {sidesOpen ? 'Hide' : 'Add-ons'}
              </button>
            </div>
            {sidesOpen && (
              <div style={{ marginTop: 14 }}>
                <div className="grid-in">
                  <div className="field">
                    <span className="label">Recipes built (${SIDE_DISH_PRICES.recipe} each)</span>
                    <NumField
                      label="Recipe setup count"
                      value={deal.sideDishes.recipes}
                      onChange={(n) => setSide('recipes', n)}
                    />
                  </div>
                  <div className="field">
                    <span className="label">Invoice back-processing, extra months (${SIDE_DISH_PRICES.invoiceBackMonth}/mo)</span>
                    <NumField
                      label="Invoice back-processing months"
                      value={deal.sideDishes.invoiceBackMonths}
                      onChange={(n) => setSide('invoiceBackMonths', n)}
                    />
                  </div>
                </div>
                <Toggle
                  on={deal.sideDishes.qbo}
                  label="QuickBooks Online setup"
                  desc={`${fmt(SIDE_DISH_PRICES.qbo)} one-time`}
                  onChange={(v) => setSide('qbo', v)}
                />
                <Toggle
                  on={deal.sideDishes.commissary}
                  label="Commissary setup"
                  desc={`${fmt(SIDE_DISH_PRICES.commissary)} one-time`}
                  onChange={(v) => setSide('commissary', v)}
                />
                <div className="card-note" style={{ marginTop: 10 }}>
                  Counted in deal value only — whether side dishes pay the rep anything is an
                  open question for Bob.
                </div>
              </div>
            )}
          </div>

          {/* ── Save ────────────────────────────────────────────── */}
          <div className="card">
            <div className="card-title">Book it</div>
            {state.error && <div className="notice err">{state.error}</div>}
            {state.savedId && (
              <div className="notice ok">
                Deal saved to {q}. Your quota position above has moved.
              </div>
            )}
            <div className="card-note" style={{ marginBottom: 14 }}>
              Commission is stored pre-accelerator; the {plan.accelerator_pct}% bump is applied
              across the whole quarter the moment you cross quota, past deals included.
            </div>
            <form action={action}>
              <input type="hidden" name="locations" value={deal.locations} />
              <input type="hidden" name="freepour" value={String(deal.freepour)} />
              <input type="hidden" name="pkg" value={deal.pkg} />
              <input type="hidden" name="saasDiscountPct" value={deal.saasDiscountPct} />
              <input type="hidden" name="recipes" value={deal.sideDishes.recipes} />
              <input type="hidden" name="qbo" value={String(deal.sideDishes.qbo)} />
              <input type="hidden" name="commissary" value={String(deal.sideDishes.commissary)} />
              <input type="hidden" name="invoiceBackMonths" value={deal.sideDishes.invoiceBackMonths} />
              <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save this deal'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right: results ──────────────────────────────────────── */}
        <div>
          <div className="card">
            <div className="card-title">Payout on this deal</div>
            <TweenedMoney value={r.commissionEffective + r.bonus} className="result-hero" />
            <div className="result-hero-label">
              {plan.commission_months} months of SaaS
              {r.isAccelerated ? ` ×1.${plan.accelerator_pct} accelerated` : ''} + package bonus
            </div>
            <div className="row">
              <span className="row-label">Deal MRR ({deal.locations} × {fmt(r.mrrPerLocation)})</span>
              <span className="row-value">{fmt(r.mrr)}<span className="muted">/mo</span></span>
            </div>
            <div className="row">
              <span className="row-label">New ARR</span>
              <span className="row-value">{fmt(r.arr)}</span>
            </div>
            <div className="row">
              <span className="row-label">SaaS commission ({plan.commission_months} months)</span>
              <span className={`row-value${r.isAccelerated ? ' green' : ''}`}>
                {fmtD(r.commissionEffective)}
              </span>
            </div>
            <div className="row">
              <span className="row-label">{PACKAGE_LABELS[deal.pkg]} package bonus</span>
              <span className="row-value gold">+{fmt(r.bonus)}</span>
            </div>
            <div className="row">
              <span className="row-label">Onboarding revenue (company)</span>
              <span className="row-value dim">{fmt(r.onboardingRevenue)}</span>
            </div>
            {r.sideDishRevenue > 0 && (
              <div className="row">
                <span className="row-label">Side dishes (company)</span>
                <span className="row-value dim">{fmt(r.sideDishRevenue)}</span>
              </div>
            )}
            {r.crossesQuota && (
              <div className="accel-note">
                <strong>This deal crosses your {q} quota.</strong> It retroactively unlocks{' '}
                {fmtD(r.retroBump)} on deals you&rsquo;ve already closed — total payout impact{' '}
                {fmtD(r.totalPayoutImpact)}.
              </div>
            )}
          </div>

          {/* ── Hold the line ─────────────────────────────────────── */}
          <div className="card">
            <div className="card-title">Hold the line</div>
            <div className="line-visual">
              <div className="line-track">
                <div className="line-fill" style={{ width: `${fillPct}%` }} />
                {lossPct > 0.2 && <div className="line-loss" style={{ width: `${lossPct}%` }} />}
                <div className="line-tick" />
              </div>
              <div className="line-caption">
                <span className="line-cap-item" style={{ color: 'var(--accent)' }}>Yours</span>
                {lossPct > 0.2 && (
                  <span className="line-cap-item" style={{ color: 'var(--red)' }}>Left on table</span>
                )}
                <span className="line-cap-item muted">Your line</span>
              </div>
            </div>
            <div className="row">
              <span className="row-label">Full-price commission</span>
              <span className="row-value green">{fmtD(r.commissionFullBase * (r.isAccelerated ? 1 + plan.accelerator_pct / 100 : 1))}</span>
            </div>
            <div className="row">
              <span className="row-label">Discounted commission</span>
              <span className={`row-value${r.hasDiscount ? ' red' : ''}`}>{fmtD(r.commissionEffective)}</span>
            </div>
            <div className="row">
              <span className="row-label strong">Money left on table</span>
              <TweenedMoney value={r.lost} className="row-value red big" />
            </div>
            {r.discountBlocksAccelerator ? (
              <div className="leaking">
                <strong>This discount keeps you under quota.</strong> At full price this deal
                crosses {fmt(plan.quarterly_arr_quota)} and unlocks +{plan.accelerator_pct}% on
                your whole quarter — worth {fmtD(r.crossingWorth)} on top of the{' '}
                {fmtD(r.lost)} it already costs you.
              </div>
            ) : r.hasDiscount ? (
              <div className="leaking">
                {fmtD(r.lost)} comes out of your paycheck, and the discounted ARR slows your
                march to the +{plan.accelerator_pct}% accelerator. The customer saves{' '}
                {fmt(r.customerSavesMonthly)}/mo.
              </div>
            ) : (
              <div className="holding">
                You&rsquo;re holding the line. Full commission, full quota credit.
              </div>
            )}
          </div>

          {/* ── Quota position ────────────────────────────────────── */}
          <div className="card">
            <div className="card-title">{q} quota position</div>
            <div className="tracker-row">
              <span className="label">Quarterly ARR quota</span>
              <div className="tracker-main">
                {fmt(r.arrAfter)} / {fmt(plan.quarterly_arr_quota)}
              </div>
              <ProgressBar pct={r.quotaPct} color={quotaBarColor} />
              <div className="tracker-sub">
                {r.isAccelerated ? (
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                    Accelerator active — +{plan.accelerator_pct}% on the whole quarter.
                  </span>
                ) : (
                  <>
                    {fmt(r.arrToQuota)} to go after this deal.{' '}
                    <span style={{ color: 'var(--accent)' }}>
                      Crossing is worth +{fmtD(r.crossingWorth)} on deals already closed.
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
