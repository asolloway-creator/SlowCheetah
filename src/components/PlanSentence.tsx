'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PRESETS,
  type AcceleratorStyle,
  type CommissionStyle,
  type CompPlan,
  type Preset,
  type QuarterlyKickerTier,
  type QuotaBasis,
} from '@/lib/calc';
import { fmt, periodNoun, planSentence } from '@/lib/format';
import PresetTiles from '@/components/PresetTiles';
import NumField from '@/components/NumField';
import Segmented from '@/components/Segmented';

const matchPreset = (plan: CompPlan) =>
  PRESETS.find((p) => JSON.stringify(p.plan) === JSON.stringify(plan))?.id ?? null;

// A real first-time user with no saved plan gets an honestly blank form, not
// PRESETS[0]'s numbers quietly standing in as if they were already chosen —
// $100,000 sitting in the quota field looks like a real, prescriptive
// default instead of an example. The demo path never reaches this: it
// always passes an actual (seeded) plan, never null.
const BLANK_PLAN: CompPlan = {
  role_name: '',
  period: 'month',
  quota_basis: 'arr',
  quota: 0,
  commission_style: 'percent',
  base_rate: 0,
  accelerator_style: 'none',
  accelerator_threshold: 0,
  accelerator_rate: 0,
  one_time_weight: 0,
  quarterly_kicker: null,
};

/** A plain text field, same visual language as NumField. */
function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-box">
        <input
          id={id}
          className="field-input"
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}

/**
 * Your plan: three preset tiles to start from, then the numbers as a
 * conventional labelled form — grouped into what you're paid on and how the
 * accelerator works. A one-line readout up top says the plan back in plain
 * English so you can check it at a glance; the form below it is what you
 * actually edit.
 *
 * `compact`: the inline dialog's version — shape, then only the numbers
 * that actually differ by shape (quota, base rate, accelerator threshold
 * and rate). Role name, period, and one-time weight stay at whatever the
 * chosen preset set them to; a link out to the full form covers anyone who
 * wants those too. Only makes sense against a real plan (demo/signed-in
 * with one already set) — never the from-scratch blank-plan path.
 */
export default function PlanSentence({
  plan,
  demo,
  onSave,
  compact = false,
}: {
  plan: CompPlan | null;
  demo: boolean;
  onSave: (p: CompPlan) => Promise<{ error?: string }>;
  compact?: boolean;
}) {
  const [p, setP] = useState<CompPlan>(plan ?? (demo ? PRESETS[0].plan : BLANK_PLAN));
  const [preset, setPreset] = useState<string | null>(plan ? matchPreset(plan) : demo ? PRESETS[0].id : null);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string }>({});

  const set = <K extends keyof CompPlan>(k: K, v: CompPlan[K]) => {
    setPreset(null);
    setMsg({});
    setP((x) => ({ ...x, [k]: v }));
  };

  // A handful of numeric fields only mean something in light of a sibling
  // selector — quota/threshold are denominated in whatever quota_basis is;
  // base_rate/accelerator_rate are denominated in whatever commission_style
  // is (accelerator_rate under 'retro_bump' is the one exception: it's
  // always a flat % bump, independent of commission_style). Carrying the
  // raw number across a switch silently reinterprets it in a new unit — a
  // "$100,000 quota" becomes "100,000 units", a "25% bump" becomes "25
  // months of MRR". Zero it instead of leaving a number that looks valid
  // but no longer means what it says.
  const setQuotaBasis = (v: QuotaBasis) => {
    setPreset(null);
    setMsg({});
    setP((x) => ({ ...x, quota_basis: v, quota: 0, accelerator_threshold: 0 }));
  };
  const setCommissionStyle = (v: CommissionStyle) => {
    setPreset(null);
    setMsg({});
    setP((x) => ({
      ...x,
      commission_style: v,
      base_rate: 0,
      accelerator_rate: x.accelerator_style === 'rate_switch' ? 0 : x.accelerator_rate,
    }));
  };
  const setAcceleratorStyle = (v: AcceleratorStyle) => {
    setPreset(null);
    setMsg({});
    setP((x) => ({ ...x, accelerator_style: v, accelerator_rate: 0 }));
  };

  // Independent of accelerator_style above — a second, optional bonus, not
  // an alternative to the first. Seeded with plausible starting tiers on
  // turning it on, not a blank 0 to type from scratch — easier to edit down
  // than up.
  const toggleKicker = (on: boolean) => {
    setPreset(null);
    setMsg({});
    setP((x) => ({
      ...x,
      quarterly_kicker: on
        ? (x.quarterly_kicker ?? { target: 0, tiers: [{ attainmentPct: 110, kickerPct: 0 }, { attainmentPct: 140, kickerPct: 0 }] })
        : null,
    }));
  };
  const setKickerTarget = (v: number) => {
    setPreset(null);
    setMsg({});
    setP((x) => (x.quarterly_kicker ? { ...x, quarterly_kicker: { ...x.quarterly_kicker, target: v } } : x));
  };
  const setKickerTier = (idx: 0 | 1, field: keyof QuarterlyKickerTier, v: number) => {
    setPreset(null);
    setMsg({});
    setP((x) => {
      if (!x.quarterly_kicker) return x;
      const tiers = [...x.quarterly_kicker.tiers] as [QuarterlyKickerTier, QuarterlyKickerTier];
      tiers[idx] = { ...tiers[idx], [field]: v };
      return { ...x, quarterly_kicker: { ...x.quarterly_kicker, tiers } };
    });
  };

  const choose = (x: Preset) => {
    setP(x.plan);
    setPreset(x.id);
    setMsg({});
  };

  // Blocks a plan from ever being *saved* in a state that would render as
  // broken the moment it's used, rather than only bounding what a field can
  // be typed to (NumField's `max` below handles that half). An accelerator
  // with a $0/0-unit threshold can never fire; a kicker left at its $0
  // default target can never be reached; a "Stretch" tier at or below the
  // base tier's attainment silently swaps which one calc.ts treats as which
  // (it sorts by attainment, not by which field you typed it into).
  function validate(plan: CompPlan): string | null {
    if (plan.accelerator_style !== 'none' && !(plan.accelerator_threshold > 0)) {
      return `Set a threshold for your accelerator — it can’t kick in at ${arr ? '$0' : '0 units'}.`;
    }
    if (plan.quarterly_kicker) {
      if (!(plan.quarterly_kicker.target > 0)) {
        return 'Set a quarterly SaaS target before saving — the kicker can’t be reached at $0.';
      }
      const [t0, t1] = plan.quarterly_kicker.tiers;
      if (!(t1.attainmentPct > t0.attainmentPct)) {
        return 'Quarterly Bonus (Stretch) attainment must be higher than the base tier’s.';
      }
    }
    return null;
  }

  async function submit() {
    const err = validate(p);
    if (err) {
      setMsg({ error: err });
      return;
    }
    setPending(true);
    setMsg({});
    const res = await onSave(p);
    setPending(false);
    setMsg(res.error ? { error: res.error } : { ok: true });
  }

  const arr = p.quota_basis === 'arr';
  const percent = p.commission_style === 'percent';
  const noun = periodNoun(p);
  const article = /^[aeiou]/i.test(p.role_name.trim()) ? 'an' : 'a';

  const target = arr ? fmt(p.quota) : `${p.quota.toLocaleString('en-US')} unit${p.quota === 1 ? '' : 's'}`;
  const isBlank = !demo && !plan && JSON.stringify(p) === JSON.stringify(BLANK_PLAN);
  const readout = isBlank
    ? 'Pick a preset above, or start filling in the fields below — this fills in as you go.'
    : `You're ${article} ${p.role_name || 'rep'} working toward a ${target} ${noun}ly quota. ${planSentence(p)}.`;

  const hasAccel = p.accelerator_style !== 'none';
  const kickerOn = p.quarterly_kicker !== null;
  const kicker = p.quarterly_kicker ?? { target: 0, tiers: [{ attainmentPct: 110, kickerPct: 0 }, { attainmentPct: 140, kickerPct: 0 }] as [QuarterlyKickerTier, QuarterlyKickerTier] };

  if (compact) {
    return (
      <div className="plan">
        <h1 className="page-title">Your plan</h1>
        <p className="plan-intro">Pick the shape closest to yours, then the numbers that matter.</p>

        <PresetTiles selected={preset} onSelect={choose} />

        <p className="plan-readout">{readout}</p>

        <NumField
          id="qk-quota"
          label={`Quota per ${noun}`}
          value={p.quota}
          prefix={arr ? '$' : undefined}
          suffix={arr ? undefined : 'units'}
          integer={!arr}
          onChange={(n) => set('quota', n)}
        />
        <div className="field-grid">
          <NumField
            id="qk-rate"
            label="Base rate"
            value={p.base_rate}
            suffix={percent ? '%' : 'months of MRR'}
            max={percent ? 100 : 36}
            onChange={(n) => set('base_rate', n)}
          />
          {hasAccel && (
            <NumField
              id="qk-th"
              label="Kicks in at"
              value={p.accelerator_threshold}
              prefix={arr ? '$' : undefined}
              suffix={arr ? undefined : 'units'}
              integer={!arr}
              onChange={(n) => set('accelerator_threshold', n)}
            />
          )}
        </div>
        {hasAccel && (
          <NumField
            id="qk-arate"
            label={p.accelerator_style === 'retro_bump' ? 'Bump, on everything closed' : 'Accelerated rate'}
            value={p.accelerator_rate}
            suffix={p.accelerator_style === 'retro_bump' ? '%' : percent ? '%' : 'months of MRR'}
            max={p.accelerator_style === 'retro_bump' || percent ? 100 : 36}
            onChange={(n) => set('accelerator_rate', n)}
          />
        )}

        <div className="plan-save">
          <p className={`plan-msg${msg.error ? ' is-error' : ''}`} aria-live="polite">
            {msg.error ?? ''}
          </p>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
            {pending ? 'Saving…' : 'Use this plan'}
          </button>
        </div>
        <p className="plan-more">
          Role, period, or how one-time products weigh in?{' '}
          <Link className="btn-text" href="/plan">
            Open the full form &rarr;
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="plan">
      <h1 className="page-title">Your plan</h1>
      <p className="plan-intro">
        {!demo && !plan
          ? 'Set your plan once — two minutes. Everything stays editable.'
          : 'Pick the shape closest to yours, then put in your numbers. Everything stays editable, and every deal recalculates.'}
      </p>

      <PresetTiles selected={preset} onSelect={choose} />

      <p className="plan-readout">{readout}</p>

      <h2 className="section-h">Role &amp; quota</h2>
      <TextField id="role" label="Role name" value={p.role_name} onChange={(v) => set('role_name', v)} placeholder="Account Executive" />
      <div className="field-grid">
        <div className="field">
          <span className="field-label">Quota period</span>
          <Segmented
            label="Quota period"
            value={p.period}
            options={[
              ['month', 'Monthly'],
              ['quarter', 'Quarterly'],
            ]}
            onChange={(v) => set('period', v)}
          />
        </div>
        <div className="field">
          <span className="field-label">Quota measured in</span>
          <Segmented
            label="Quota measured in"
            value={p.quota_basis}
            options={[
              ['arr', 'New ARR'],
              ['units', 'Units'],
            ]}
            onChange={setQuotaBasis}
          />
        </div>
      </div>
      <NumField
        id="quota"
        label={`Quota per ${noun}`}
        value={p.quota}
        prefix={arr ? '$' : undefined}
        suffix={arr ? undefined : 'units'}
        integer={!arr}
        onChange={(n) => set('quota', n)}
      />

      <h2 className="section-h">Commission</h2>
      <div className="field-grid">
        <div className="field">
          <span className="field-label">Paid as</span>
          <Segmented
            label="Commission paid as"
            value={p.commission_style}
            options={[
              ['months_of_mrr', 'Months of MRR'],
              ['percent', '% of deal value'],
            ]}
            onChange={setCommissionStyle}
          />
        </div>
        <NumField
          id="rate"
          label="Base rate"
          value={p.base_rate}
          suffix={percent ? '%' : 'months of MRR'}
          max={percent ? 100 : 36}
          onChange={(n) => set('base_rate', n)}
        />
      </div>
      {percent && (
        <NumField id="w1" label="One-time products count at" value={p.one_time_weight} suffix="%" max={100} onChange={(n) => set('one_time_weight', n)} />
      )}

      <h2 className="section-h">Accelerator</h2>
      <div className="field">
        <span className="field-label">Style</span>
        <Segmented
          label="Accelerator style"
          value={p.accelerator_style}
          options={[
            ['none', 'None'],
            ['rate_switch', 'Rate switch'],
            ['retro_bump', 'Retroactive bump'],
          ]}
          onChange={setAcceleratorStyle}
        />
      </div>
      <p className="field-note">
        {p.accelerator_style === 'none' && 'Same rate on every deal, all ' + noun + ' long. Quota is still tracked.'}
        {p.accelerator_style === 'rate_switch' && `Once the threshold lands, every deal from that one on earns the accelerated rate. Earlier deals keep the base rate.`}
        {p.accelerator_style === 'retro_bump' && `Once the threshold lands, the bump applies to every deal in the ${noun} — including the ones already closed.`}
      </p>
      {p.accelerator_style !== 'none' && (
        <div className="field-grid">
          <NumField
            id="th"
            label="Kicks in at"
            value={p.accelerator_threshold}
            prefix={arr ? '$' : undefined}
            suffix={arr ? undefined : 'units'}
            integer={!arr}
            onChange={(n) => set('accelerator_threshold', n)}
          />
          <NumField
            id="arate"
            label={p.accelerator_style === 'retro_bump' ? 'Bump, on everything closed' : 'Accelerated rate'}
            value={p.accelerator_rate}
            suffix={p.accelerator_style === 'retro_bump' ? '%' : percent ? '%' : 'months of MRR'}
            max={p.accelerator_style === 'retro_bump' || percent ? 100 : 36}
            onChange={(n) => set('accelerator_rate', n)}
          />
        </div>
      )}

      <h2 className="section-h">Quarterly SaaS kicker</h2>
      <div className="field">
        <span className="field-label">Style</span>
        <Segmented
          label="Quarterly SaaS kicker"
          value={kickerOn ? 'on' : 'off'}
          options={[
            ['off', 'Off'],
            ['on', 'On'],
          ]}
          onChange={(v) => toggleKicker(v === 'on')}
        />
      </div>
      <p className="field-note">
        A second, independent bonus some plans stack on top of the accelerator above — cross a % of cumulative
        quarterly SaaS attainment and the whole quarter&rsquo;s SaaS commission gets a kicker.
      </p>
      {kickerOn && (
        <>
          <NumField
            id="kk-target"
            label="Quarterly SaaS target"
            value={kicker.target}
            prefix="$"
            onChange={setKickerTarget}
          />
          <div className="field-grid">
            <NumField
              id="kk-t1-pct"
              label="Quarterly Bonus attainment"
              value={kicker.tiers[0].attainmentPct}
              suffix="%"
              max={1000}
              onChange={(n) => setKickerTier(0, 'attainmentPct', n)}
            />
            <NumField
              id="kk-t1-kick"
              label="Quarterly Bonus kicker"
              value={kicker.tiers[0].kickerPct}
              suffix="%"
              max={200}
              onChange={(n) => setKickerTier(0, 'kickerPct', n)}
            />
          </div>
          <div className="field-grid">
            <NumField
              id="kk-t2-pct"
              label="Quarterly Bonus (Stretch) attainment"
              value={kicker.tiers[1].attainmentPct}
              suffix="%"
              max={1000}
              onChange={(n) => setKickerTier(1, 'attainmentPct', n)}
            />
            <NumField
              id="kk-t2-kick"
              label="Quarterly Bonus (Stretch) kicker"
              value={kicker.tiers[1].kickerPct}
              suffix="%"
              max={200}
              onChange={(n) => setKickerTier(1, 'kickerPct', n)}
            />
          </div>
        </>
      )}

      <div className="plan-save">
        <p className={`plan-msg${msg.error ? ' is-error' : ''}`} aria-live="polite">
          {msg.error ?? (msg.ok ? 'Saved. Every deal now recalculates against it.' : '')}
        </p>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
          {pending ? 'Saving…' : demo ? 'Use this plan' : 'Save my plan'}
        </button>
      </div>
    </div>
  );
}
