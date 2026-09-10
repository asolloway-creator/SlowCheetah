'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { calc, periodLabel, type CompPlan, type DealInput, type PeriodToDate } from '@/lib/calc';
import { fmt, fmtD, fmtCredit, fmtRate, periodNoun } from '@/lib/format';
import TweenedMoney from '@/components/TweenedMoney';
import DiscountSlider from '@/components/DiscountSlider';
import ProgressBar from '@/components/ProgressBar';

const EMPTY: DealInput = {
  oneTime: 0, implementation: 0, subscription: 0, subMode: 'mrr', units: 1, attach: false,
  oneTimeDiscountPct: 0, implementationDiscountPct: 0, subscriptionDiscountPct: 0,
};

/** Demo starts on a real-looking deal so the first thing a visitor sees moves. */
const SAMPLE: DealInput = { ...EMPTY, oneTime: 3000, subscription: 1050, units: 3 };

function NumField({ label, value, onChange, prefix, step = 1, min = 0 }: {
  label: string; value: number; onChange: (n: number) => void; prefix?: string; step?: number; min?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [emitted, setEmitted] = useState(value);
  if (value !== emitted) { setEmitted(value); setDraft(String(value)); }
  function handle(raw: string) {
    setDraft(raw);
    const n = parseFloat(raw);
    const next = isNaN(n) ? min : Math.max(min, n);
    setEmitted(next); onChange(next);
  }
  return (
    <div className="input-row">
      {prefix && <span className="prefix">{prefix}</span>}
      <input type="number" className="num" value={draft} step={step} min={min}
        onChange={(e) => handle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        aria-label={label} />
    </div>
  );
}

function Toggle({ on, label, desc, onChange }: { on: boolean; label: string; desc: React.ReactNode; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div style={{ flex: 1 }}>
        <span className="toggle-name">{label}</span>
        <span className={`toggle-desc${on ? ' active' : ''}`}>{desc}</span>
      </div>
      <button type="button" className={`toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

export default function DealBuilder({ plan, ptd, demo, onSave }: {
  plan: CompPlan; ptd: PeriodToDate; demo: boolean; onSave: (deal: DealInput) => Promise<{ error?: string }>;
}) {
  const [deal, setDeal] = useState<DealInput>(demo ? SAMPLE : EMPTY);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  const set = <K extends keyof DealInput>(k: K, v: DealInput[K]) => setDeal((d) => ({ ...d, [k]: v }));

  const r = useMemo(() => calc(plan, deal, ptd), [plan, deal, ptd]);
  const rOn = useMemo(() => calc(plan, { ...deal, attach: true }, ptd), [plan, deal, ptd]);
  const attachDelta = rOn.totalPayoutImpact - r.totalPayoutImpact;
  const attachCredit = rOn.credit - r.credit;
  const attachCrosses = plan.attach_enabled && !deal.attach && rOn.crossesAccelerator && !r.crossesAccelerator;

  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const retro = plan.accelerator_style === 'retro_bump';
  const hasAccel = plan.accelerator_style !== 'none';
  const empty = deal.oneTime === 0 && deal.implementation === 0 && deal.subscription === 0;

  const fillPct = r.commissionFullEffective > 0 ? Math.max(0, Math.min(100, (r.commissionEffective / r.commissionFullEffective) * 100)) : 100;
  const lossPct = 100 - fillPct;
  const barColor = r.isAccelerated ? 'var(--green)' : r.quotaPct >= 70 ? 'var(--amber)' : 'var(--steel)';

  async function submit() {
    setPending(true); setMsg({});
    const res = await onSave(deal);
    setPending(false);
    if (res.error) setMsg({ error: res.error });
    else { setMsg({ ok: `Deal booked to ${label}.` }); setDeal(EMPTY); }
  }

  const accelWord = retro ? `+${plan.accelerator_rate}%` : fmtRate(plan, plan.accelerator_rate);

  return (
    <>
      {demo && (
        <div className="sample-chip">
          <span className="sample-dot" />
          You&rsquo;re looking at a sample rep &mdash; {plan.role_name}, {fmtCredit(plan, plan.quota)} {noun}ly quota, {Math.round((ptd.creditBooked / plan.quota) * 100)}% there.
          <Link href="/plan">Swap in your plan &rarr;</Link>
        </div>
      )}
      <div className="context">
        <div className="ctx-field"><span className="label">Plan</span><span className="ctx-value">{plan.role_name}</span></div>
        <div className="ctx-field">
          <span className="label">{label} booked</span>
          <span className="ctx-value">{fmtCredit(plan, ptd.creditBooked)} / {fmtCredit(plan, plan.quota)}</span>
        </div>
        <div className="rate-block">
          {hasAccel && r.wasAccelerated ? (
            <>
              <span className="rate-num" style={{ color: 'var(--green)' }}>{accelWord}</span>
              <div className="rate-side">
                <span className="rate-state" style={{ color: 'var(--green)' }}>ACCELERATED</span>
                <span className="rate-note">{retro ? `every deal this ${noun} earns the bump` : `base was ${fmtRate(plan, plan.base_rate)}`}</span>
              </div>
            </>
          ) : (
            <>
              <span className="rate-num" style={{ color: 'var(--amber)' }}>
                {hasAccel ? fmtCredit(plan, Math.max(0, plan.accelerator_threshold - ptd.creditBooked)) : fmtRate(plan, plan.base_rate)}
              </span>
              <div className="rate-side">
                <span className="rate-state" style={{ color: 'var(--amber)' }}>{hasAccel ? 'TO ACCELERATOR' : 'FLAT RATE'}</span>
                <span className="rate-note">
                  {hasAccel ? (retro ? `crossing unlocks ${accelWord} on the whole ${noun}` : `then every deal earns ${accelWord}`) : 'no accelerator on this plan'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="card">
            <div className="card-title">Deal builder</div>
            <div className="grid-in">
              <div className="field"><span className="label">One-time products</span>
                <NumField label="One-time products" value={deal.oneTime} onChange={(n) => set('oneTime', n)} prefix="$" step={500} /></div>
              <div className="field"><span className="label">Implementation</span>
                <NumField label="Implementation" value={deal.implementation} onChange={(n) => set('implementation', n)} prefix="$" step={100} /></div>
              <div className="field">
                <div className="field-head">
                  <span className="label">{deal.subMode === 'acv' ? 'Subscription ACV / yr' : 'Subscription / mo'}</span>
                  <div className="seg">
                    <button type="button" className={deal.subMode === 'mrr' ? 'on' : ''} onClick={() => set('subMode', 'mrr')}>MRR</button>
                    <button type="button" className={deal.subMode === 'acv' ? 'on' : ''} onClick={() => set('subMode', 'acv')}>ACV</button>
                  </div>
                </div>
                <NumField label="Subscription" value={deal.subscription} onChange={(n) => set('subscription', n)} prefix="$" step={50} />
              </div>
              <div className="field"><span className="label">Units</span>
                <NumField label="Units" value={deal.units} onChange={(n) => set('units', Math.max(1, Math.round(n)))} min={1} /></div>
            </div>

            {plan.attach_enabled && (
              <Toggle on={deal.attach} label={plan.attach_name || 'Attach product'}
                desc={deal.attach
                  ? `On all ${r.units} unit${r.units !== 1 ? 's' : ''} — +${fmt(plan.attach_mrr)}/mo each`
                  : <span className="nudge">Attach for <strong>+{fmtD(attachDelta)}</strong> on this deal and <strong>+{fmtCredit(plan, attachCredit)}</strong> toward quota{attachCrosses && ` — it crosses your accelerator${retro ? ` and unlocks +${fmtD(rOn.retroBump)} retroactively` : ''}`}</span>}
                onChange={(v) => set('attach', v)} />
            )}

            <div className="card-title" style={{ margin: '18px 0 12px' }}>Discounts</div>
            <DiscountSlider id="otD" label="One-time products" value={deal.oneTimeDiscountPct} baseAmount={deal.oneTime} onChange={(v) => set('oneTimeDiscountPct', v)} />
            <DiscountSlider id="implD" label="Implementation" value={deal.implementationDiscountPct} baseAmount={deal.implementation} onChange={(v) => set('implementationDiscountPct', v)} />
            <DiscountSlider id="subD" label="Subscription" value={deal.subscriptionDiscountPct} baseAmount={r.subMrrList} onChange={(v) => set('subscriptionDiscountPct', v)} />
          </div>

          <div className="card">
            <div className="card-title">Book it</div>
            {msg.error && <div className="notice err">{msg.error}</div>}
            {msg.ok && <div className="notice ok">{msg.ok} Your position above has moved. <Link href="/quota" style={{ fontWeight: 600, textDecoration: 'underline' }}>See it on your quota &rarr;</Link></div>}
            <div className="card-note" style={{ marginBottom: 14 }}>
              {demo
                ? 'Booking saves to this browser only. Sign in to keep deals across devices and sessions.'
                : retro
                  ? `Commission is stored pre-accelerator; the ${plan.accelerator_rate}% bump is applied across the whole ${noun} the moment you cross, past deals included.`
                  : 'Commission is stored as earned at booking, so history stays accurate after the accelerator kicks in.'}
            </div>
            <button className="btn btn-primary btn-lg" type="button" disabled={pending || empty} onClick={submit}>
              {pending ? 'Saving…' : 'Book this deal'}
            </button>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">Commission on this deal</div>
            <TweenedMoney value={r.commissionEffective} className="result-hero" />
            <div className="result-hero-label">
              {fmtRate(plan, r.effectiveRate)}{retro && r.isAccelerated ? ` ×1.${plan.accelerator_rate} accelerated` : ''} · mapped to your plan and {noun} position
            </div>
            {plan.commission_style === 'percent' ? (
              <>
                <div className="row"><span className="row-label">Commissionable value (list)</span><span className="row-value">{fmt(r.commissionableFull)}</span></div>
                {r.hasDiscount && <div className="row"><span className="row-label">After discounts</span><span className="row-value red">{fmt(r.commissionable)}</span></div>}
              </>
            ) : (
              <div className="row"><span className="row-label">Deal MRR{r.attachMrr > 0 ? ' incl. attach' : ''}</span><span className="row-value">{fmt(r.subMrr)}<span className="muted">/mo</span></span></div>
            )}
            {r.subAnnual > 0 && <div className="row"><span className="row-label">New ARR</span><span className="row-value">{fmt(r.subAnnual)}</span></div>}
            <div className="row"><span className="row-label">Rate</span><span className={`row-value${r.isAccelerated ? ' green' : ''}`}>{fmtRate(plan, r.effectiveRate)}</span></div>
            {r.hasDiscount && <div className="row"><span className="row-label">Customer saves</span><span className="row-value">{fmt(r.customerSavesAnnual)}<span className="muted">/yr</span></span></div>}
            <div className="row"><span className="row-label">{label} after this deal</span><span className="row-value">{fmtCredit(plan, r.creditAfter)} / {fmtCredit(plan, plan.quota)}</span></div>
            {r.crossesAccelerator && (
              <div className="accel-note">
                {retro
                  ? <><strong>This deal crosses your {label} threshold.</strong> It retroactively unlocks {fmtD(r.retroBump)} on deals already closed — total payout impact {fmtD(r.totalPayoutImpact)}.</>
                  : <><strong>This deal triggers your accelerator.</strong> Every deal after this one earns {accelWord}.</>}
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
                <span className="line-cap-item" style={{ color: 'var(--green)' }}>Yours</span>
                {lossPct > 0.2 && <span className="line-cap-item" style={{ color: 'var(--red)' }}>Left on table</span>}
                <span className="line-cap-item muted">Your line</span>
              </div>
            </div>
            <div className="row"><span className="row-label">Full-price commission</span><span className="row-value green">{fmtD(r.commissionFullEffective)}</span></div>
            <div className="row"><span className="row-label">Discounted commission</span><span className={`row-value${r.hasDiscount ? ' red' : ''}`}>{fmtD(r.commissionEffective)}</span></div>
            <div className="row"><span className="row-label strong">Money left on table</span><TweenedMoney value={r.lost} className="row-value red big" /></div>
            {r.discountBlocksAccelerator ? (
              <div className="leaking">
                <strong>This discount keeps you under your accelerator.</strong> At full price this deal crosses {fmtCredit(plan, plan.accelerator_threshold)}
                {retro ? ` and unlocks ${accelWord} on your whole ${noun} — worth ${fmtD(r.crossingWorth)} on top of the ${fmtD(r.lost)} it already costs you.` : ` and every deal after it earns ${accelWord}.`}
              </div>
            ) : r.hasDiscount ? (
              <div className="leaking">{fmtD(r.lost)} comes out of your paycheck on this deal. The customer saves {fmt(r.customerSavesAnnual)} a year — you&rsquo;re the one paying for part of it.</div>
            ) : (
              <div className="holding">You&rsquo;re holding the line. Full commission, full quota credit.</div>
            )}
          </div>

          <div className="card">
            <div className="card-title">{label} position</div>
            <div className="tracker-row">
              <span className="label">{plan.period === 'quarter' ? 'Quarterly' : 'Monthly'} quota</span>
              <div className="tracker-main">{fmtCredit(plan, r.creditAfter)} / {fmtCredit(plan, plan.quota)}</div>
              <ProgressBar pct={r.quotaPct} color={barColor} />
              <div className="tracker-sub">
                {r.attained ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Quota made after this deal.</span> : <>{fmtCredit(plan, r.toQuota)} to go after this deal.</>}{' '}
                {hasAccel && !r.isAccelerated && retro && <span style={{ color: 'var(--amber)' }}>Crossing is worth +{fmtD(r.crossingWorth)} on deals already closed.</span>}
                {hasAccel && r.isAccelerated && <span style={{ color: 'var(--green)', fontWeight: 600 }}>Accelerator active at {accelWord}.</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
