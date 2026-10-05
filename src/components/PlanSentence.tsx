'use client';

import { useEffect, useRef, useState } from 'react';
import { trackOnce, type TrackContext } from '@/lib/track';
import {
  COMPANY_SIZE_BANDS,
  isFixedTier,
  PRESETS,
  type AcceleratorStep,
  type AcceleratorStyle,
  type CommissionStyle,
  type CompPlan,
  type Preset,
  type QuarterlyKicker,
  type QuarterlyKickerTier,
  type QuotaBasis,
} from '@/lib/calc';
import { fmt, periodNoun, planSentence } from '@/lib/format';
import PresetTiles from '@/components/PresetTiles';
import NumField from '@/components/NumField';
import Segmented from '@/components/Segmented';

/** The plan with these further accelerator steps, or none: no empty list
 *  left behind, so a one-step plan stays exactly what it was. */
function withSteps(plan: CompPlan, steps: AcceleratorStep[]): CompPlan {
  const { accelerator_steps: _drop, ...rest } = plan;
  void _drop;
  return steps.length ? { ...rest, accelerator_steps: steps } : rest;
}

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
  industry: null,
  company_size_band: null,
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
 * Since plans are usually described in words now (components/capture),
 * this is the "adjust the numbers" path: for anyone who'd rather type the
 * numbers, or wants to fine-tune what was read.
 */
export default function PlanSentence({
  plan,
  demo,
  onSave,
  trackAs,
}: {
  plan: CompPlan | null;
  demo: boolean;
  onSave: (p: CompPlan) => Promise<{ error?: string }>;
  /** Analytics context the form was opened from (see lib/track.ts). */
  trackAs?: TrackContext;
}) {
  // Whatever context the form was opened from, fixed at mount: saving a plan
  // flips the demo from 'sample' to 'own' while this is still on screen, and
  // that isn't a second opening.
  const openedAs = useRef<TrackContext>(trackAs ?? (demo ? 'sample' : 'account'));
  useEffect(() => {
    trackOnce('plan_form_opened', openedAs.current);
  }, []);

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
    setP((x) => withSteps({ ...x, quota_basis: v, quota: 0, accelerator_threshold: 0 }, []));
  };
  const setCommissionStyle = (v: CommissionStyle) => {
    setPreset(null);
    setMsg({});
    setP((x) =>
      withSteps(
        {
          ...x,
          commission_style: v,
          base_rate: 0,
          accelerator_rate: x.accelerator_style === 'rate_switch' ? 0 : x.accelerator_rate,
        },
        x.accelerator_style === 'rate_switch' ? (x.accelerator_steps ?? []).map((st) => ({ ...st, rate: 0 })) : (x.accelerator_steps ?? []),
      ),
    );
  };
  const setAcceleratorStyle = (v: AcceleratorStyle) => {
    setPreset(null);
    setMsg({});
    setP((x) => withSteps({ ...x, accelerator_style: v, accelerator_rate: 0 }, []));
  };

  // Further accelerator steps past the first: "12% past $150,000, then 15%
  // past $187,500". Each starts past the one before it; up to three.
  const steps = p.accelerator_steps ?? [];
  const setStep = (i: number, field: keyof AcceleratorStep, v: number) => {
    setPreset(null);
    setMsg({});
    setP((x) => withSteps(x, (x.accelerator_steps ?? []).map((st, k) => (k === i ? { ...st, [field]: v } : st))));
  };
  const addStep = () => {
    setPreset(null);
    setMsg({});
    setP((x) => {
      const list = x.accelerator_steps ?? [];
      const last = list.length ? list[list.length - 1].threshold : x.accelerator_threshold;
      const next = x.quota_basis === 'units' ? Math.max(last + 1, Math.ceil(last * 1.25)) : Math.round(last * 1.25);
      return withSteps(x, [...list, { threshold: next, rate: 0 }]);
    });
  };
  const removeStep = () => {
    setPreset(null);
    setMsg({});
    setP((x) => withSteps(x, (x.accelerator_steps ?? []).slice(0, -1)));
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
  // What every level pays: a percent of the quarter's commission, or a fixed
  // amount. One choice for the whole bonus, so its levels never mix.
  const setKickerPays = (mode: 'percent' | 'fixed') => {
    setPreset(null);
    setMsg({});
    setP((x) => {
      if (!x.quarterly_kicker) return x;
      const tiers = x.quarterly_kicker.tiers.map((t) =>
        mode === 'fixed'
          ? { attainmentPct: t.attainmentPct, kickerPct: 0, amount: t.amount ?? 0 }
          : { attainmentPct: t.attainmentPct, kickerPct: t.kickerPct },
      ) as QuarterlyKicker['tiers'];
      return { ...x, quarterly_kicker: { ...x.quarterly_kicker, tiers } };
    });
  };
  const setKickerTier = (idx: 0 | 1, field: keyof QuarterlyKickerTier, v: number) => {
    setPreset(null);
    setMsg({});
    setP((x) => {
      if (!x.quarterly_kicker || !x.quarterly_kicker.tiers[idx]) return x;
      const tiers = [...x.quarterly_kicker.tiers] as QuarterlyKicker['tiers'];
      tiers[idx] = { ...tiers[idx]!, [field]: v };
      return { ...x, quarterly_kicker: { ...x.quarterly_kicker, tiers } };
    });
  };
  // The stretch tier is optional: plenty of plans pay one bonus level.
  const setStretch = (on: boolean) => {
    setPreset(null);
    setMsg({});
    setP((x) => {
      if (!x.quarterly_kicker) return x;
      const [t0] = x.quarterly_kicker.tiers;
      const at = Math.max(t0.attainmentPct + 20, 140);
      const tiers: QuarterlyKicker['tiers'] = on
        ? [t0, isFixedTier(t0) ? { attainmentPct: at, kickerPct: 0, amount: 0 } : { attainmentPct: at, kickerPct: 0 }]
        : [t0];
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
      return `Set a threshold for your accelerator. It can’t kick in at ${arr ? '$0' : '0 units'}.`;
    }
    let last = plan.accelerator_threshold;
    for (const st of plan.accelerator_steps ?? []) {
      if (!(st.threshold > last)) return 'Each accelerator step has to start past the one before it.';
      if (!(st.rate > 0)) return 'Set a rate for each accelerator step.';
      last = st.threshold;
    }
    if (plan.quarterly_kicker) {
      if (!(plan.quarterly_kicker.target > 0)) {
        return 'Set a quarterly SaaS target before saving. The kicker can’t be reached at $0.';
      }
      const [t0, t1] = plan.quarterly_kicker.tiers;
      if (t1 && !(t1.attainmentPct > t0.attainmentPct)) {
        return 'Quarterly Bonus (Stretch) attainment must be higher than the base tier’s.';
      }
      if (plan.quarterly_kicker.tiers.some((t) => isFixedTier(t) && !((t.amount as number) > 0))) {
        return 'Set what the Quarterly Bonus pays.';
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
    // onSave is a server action call — a network failure or timeout
    // rejects rather than resolving to {error}, which without this would
    // leave pending stuck true and the button reading "Saving…" forever.
    let res: { error?: string };
    try {
      res = await onSave(p);
    } catch {
      setPending(false);
      setMsg({ error: 'Could not reach the server. Check your connection and try again.' });
      return;
    }
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
    ? 'Pick a preset above, or start on the fields below. This line fills in as you go.'
    : `You're ${article} ${p.role_name || 'rep'} working toward a ${noun}ly quota of ${target}. ${planSentence(p)}.`;

  const kickerOn = p.quarterly_kicker !== null;
  const kicker: QuarterlyKicker = p.quarterly_kicker ?? {
    target: 0,
    tiers: [{ attainmentPct: 110, kickerPct: 0 }, { attainmentPct: 140, kickerPct: 0 }],
  };
  const stretch = kicker.tiers[1] ?? null;
  const fixedBonus = kicker.tiers.some(isFixedTier);
  // The second field of each level: its percent, or its fixed amount.
  const paysField = (idx: 0 | 1, t: QuarterlyKickerTier, name: string) =>
    fixedBonus ? (
      <NumField
        id={`kk-t${idx + 1}-amount`}
        label={`${name} amount`}
        value={t.amount ?? 0}
        prefix="$"
        max={10_000_000}
        onChange={(n) => setKickerTier(idx, 'amount', n)}
      />
    ) : (
      <NumField
        id={`kk-t${idx + 1}-kick`}
        label={`${name} kicker`}
        value={t.kickerPct}
        suffix="%"
        max={200}
        onChange={(n) => setKickerTier(idx, 'kickerPct', n)}
      />
    );

  return (
    <div className="plan">
      <h1 className="page-title">Your plan</h1>
      <p className="plan-intro">
        {!demo && !plan
          ? 'Set your plan once. It takes two minutes, and everything stays editable.'
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
        {p.accelerator_style === 'retro_bump' && `Once the threshold lands, the bump applies to every deal in the ${noun}, including the ones already closed.`}
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
      {p.accelerator_style !== 'none' &&
        steps.map((st, i) => (
          <div key={i} className="field-grid">
            <NumField
              id={`th-${i + 2}`}
              label={`Step ${i + 2} kicks in at`}
              value={st.threshold}
              prefix={arr ? '$' : undefined}
              suffix={arr ? undefined : 'units'}
              integer={!arr}
              onChange={(n) => setStep(i, 'threshold', n)}
            />
            <NumField
              id={`arate-${i + 2}`}
              label={p.accelerator_style === 'retro_bump' ? `Step ${i + 2} bump, on everything closed` : `Step ${i + 2} rate`}
              value={st.rate}
              suffix={p.accelerator_style === 'retro_bump' ? '%' : percent ? '%' : 'months of MRR'}
              max={p.accelerator_style === 'retro_bump' || percent ? 100 : 36}
              onChange={(n) => setStep(i, 'rate', n)}
            />
          </div>
        ))}
      {p.accelerator_style !== 'none' && (
        <div className="plan-steps">
          {steps.length < 3 && (
            <button type="button" className="btn-text" onClick={addStep}>
              Add another step
            </button>
          )}
          {steps.length > 0 && (
            <button type="button" className="btn-text" onClick={removeStep}>
              Remove the last step
            </button>
          )}
        </div>
      )}

      <h2 className="section-h">Quarterly Bonus</h2>
      <div className="field">
        <span className="field-label">Style</span>
        <Segmented
          label="Quarterly Bonus"
          value={kickerOn ? 'on' : 'off'}
          options={[
            ['off', 'Off'],
            ['on', 'On'],
          ]}
          onChange={(v) => toggleKicker(v === 'on')}
        />
      </div>
      <p className="field-note">
        A second, independent bonus some plans stack on top of the accelerator above. Cross a set % of the
        quarter&rsquo;s new ARR target and it pays out: a kicker on the whole quarter&rsquo;s SaaS commission, or a
        fixed amount.
      </p>
      {kickerOn && (
        <>
          <div className="field-grid">
            <NumField
              id="kk-target"
              label="Quarterly SaaS target"
              value={kicker.target}
              prefix="$"
              onChange={setKickerTarget}
            />
            <div className="field">
              <span className="field-label">Pays</span>
              <Segmented
                label="Quarterly Bonus pays"
                value={fixedBonus ? 'fixed' : 'percent'}
                options={[
                  ['percent', 'A kicker %'],
                  ['fixed', 'A fixed amount'],
                ]}
                onChange={setKickerPays}
              />
            </div>
          </div>
          <div className="field-grid">
            <NumField
              id="kk-t1-pct"
              label="Quarterly Bonus attainment"
              value={kicker.tiers[0].attainmentPct}
              suffix="%"
              max={1000}
              onChange={(n) => setKickerTier(0, 'attainmentPct', n)}
            />
            {paysField(0, kicker.tiers[0], 'Quarterly Bonus')}
          </div>
          {stretch ? (
            <>
              <div className="field-grid">
                <NumField
                  id="kk-t2-pct"
                  label="Quarterly Bonus (Stretch) attainment"
                  value={stretch.attainmentPct}
                  suffix="%"
                  max={1000}
                  onChange={(n) => setKickerTier(1, 'attainmentPct', n)}
                />
                {paysField(1, stretch, 'Quarterly Bonus (Stretch)')}
              </div>
              <button type="button" className="btn-text" onClick={() => setStretch(false)}>
                Remove the stretch tier
              </button>
            </>
          ) : (
            <button type="button" className="btn-text" onClick={() => setStretch(true)}>
              Add a stretch tier
            </button>
          )}
        </>
      )}

      <h2 className="section-h">About your company</h2>
      <p className="field-note">
        Optional, never required to save. Only used later to compare your plan against others shaped like it.
        Company size is stored as a band, never an exact headcount, and no company name is ever captured.
      </p>
      <div className="field-grid">
        <TextField id="industry" label="Industry" value={p.industry ?? ''} onChange={(v) => set('industry', v || null)} placeholder="SaaS" />
        <div className="field">
          <label className="field-label" htmlFor="company-size">
            Company size
          </label>
          <div className="field-box">
            <select
              id="company-size"
              className="field-input"
              value={p.company_size_band ?? ''}
              onChange={(e) => set('company_size_band', e.target.value || null)}
            >
              <option value="">Prefer not to say</option>
              {COMPANY_SIZE_BANDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
