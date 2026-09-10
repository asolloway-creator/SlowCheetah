'use client';

import { useState } from 'react';
import { PRESETS, type CompPlan, type Preset } from '@/lib/calc';
import { periodNoun } from '@/lib/format';
import PresetTiles from '@/components/PresetTiles';

const matchPreset = (plan: CompPlan) =>
  PRESETS.find((p) => JSON.stringify(p.plan) === JSON.stringify(plan))?.id ?? null;

const showNum = (n: number, money: boolean) =>
  `${money ? '$' : ''}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** A text blank sized to its content. */
function TextBlank({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <span className="blank-wrap" data-value={value || label}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="blank"
        type="text"
        value={value}
        placeholder={label}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </span>
  );
}

/** A numeric blank: formatted at rest, raw digits while focused. */
function NumBlank({
  id,
  label,
  value,
  onChange,
  money = false,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  money?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(showNum(value, money));
  const [emitted, setEmitted] = useState(value);
  if (value !== emitted) {
    setEmitted(value);
    setDraft(focused ? String(value) : showNum(value, money));
  }
  const parse = (raw: string) => {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
    return Number.isNaN(n) ? 0 : Math.max(0, Math.round(n * 100) / 100);
  };
  return (
    <span className="blank-wrap" data-value={draft || '0'}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="blank"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parse(e.target.value);
          setEmitted(n);
          onChange(n);
        }}
        onFocus={() => {
          setFocused(true);
          setDraft(String(value));
        }}
        onBlur={() => {
          setFocused(false);
          setDraft(showNum(parse(draft), money));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </span>
  );
}

/** A native select styled as an underlined word with a chevron. */
function Choice<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const shown = options.find(([v]) => v === value)?.[1] ?? '';
  return (
    <span className="blank-wrap blank-wrap-select" data-value={shown}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="blank blank-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Your plan, in a sentence: three preset tiles, then the plan rendered as
 * prose with editable blanks. Editing any blank deselects the tiles.
 */
export default function PlanSentence({
  plan,
  demo,
  onSave,
}: {
  plan: CompPlan | null;
  demo: boolean;
  onSave: (p: CompPlan) => Promise<{ error?: string }>;
}) {
  const [p, setP] = useState<CompPlan>(plan ?? PRESETS[0].plan);
  const [preset, setPreset] = useState<string | null>(plan ? matchPreset(plan) : PRESETS[0].id);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string }>({});

  const set = <K extends keyof CompPlan>(k: K, v: CompPlan[K]) => {
    setPreset(null);
    setMsg({});
    setP((x) => ({ ...x, [k]: v }));
  };
  const choose = (x: Preset) => {
    setP(x.plan);
    setPreset(x.id);
    setMsg({});
  };

  async function submit() {
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
  const unit = arr ? ' in new ARR' : ' units';

  return (
    <div className="plan">
      <h1 className="page-title">Your plan</h1>
      <p className="plan-intro">
        {!demo && !plan
          ? 'Set your plan once — two minutes. Everything stays editable.'
          : 'Pick the shape closest to yours, then put in your numbers. Everything stays editable, and every deal recalculates.'}
      </p>

      <PresetTiles selected={preset} onSelect={choose} />

      <h2 className="section-h">Your plan, in a sentence</h2>
      <p className="plan-sentence">
        I&rsquo;m {article} <TextBlank id="role" label="Role name" value={p.role_name} onChange={(v) => set('role_name', v)} />
        . My quota is{' '}
        <NumBlank id="quota" label={`Quota per ${noun}`} value={p.quota} money={arr} onChange={(n) => set('quota', n)} />
        {arr ? ' of ' : ' '}
        <Choice
          id="basis"
          label="Quota measured in"
          value={p.quota_basis}
          options={[
            ['arr', 'new ARR'],
            ['units', 'units'],
          ]}
          onChange={(v) => set('quota_basis', v)}
        />{' '}
        per{' '}
        <Choice
          id="period"
          label="Quota period"
          value={p.period}
          options={[
            ['quarter', 'quarter'],
            ['month', 'month'],
          ]}
          onChange={(v) => set('period', v)}
        />
        . I earn <NumBlank id="rate" label="Base rate" value={p.base_rate} onChange={(n) => set('base_rate', n)} />{' '}
        <Choice
          id="style"
          label="Commission paid as"
          value={p.commission_style}
          options={[
            ['months_of_mrr', 'months of MRR'],
            ['percent', '% of deal value'],
          ]}
          onChange={(v) => set('commission_style', v)}
        />{' '}
        on every deal.{' '}
        {percent && (
          <>
            One-time products count at{' '}
            <NumBlank id="w1" label="One-time products weight, percent" value={p.one_time_weight} onChange={(n) => set('one_time_weight', n)} />
            % and implementation at{' '}
            <NumBlank id="w2" label="Implementation weight, percent" value={p.implementation_weight} onChange={(n) => set('implementation_weight', n)} />
            %.{' '}
          </>
        )}
        <Choice
          id="accel"
          label="Accelerator"
          value={p.accelerator_style}
          options={[
            ['retro_bump', 'When I cross'],
            ['rate_switch', 'Once I land'],
            ['none', 'There’s no accelerator'],
          ]}
          onChange={(v) => set('accelerator_style', v)}
        />
        {p.accelerator_style === 'retro_bump' && (
          <>
            {' '}
            <NumBlank id="th" label="Accelerator threshold" value={p.accelerator_threshold} money={arr} onChange={(n) => set('accelerator_threshold', n)} />
            {unit}, every deal this {noun} pays{' '}
            <NumBlank id="arate" label="Bump, percent" value={p.accelerator_rate} onChange={(n) => set('accelerator_rate', n)} />% more — including the ones
            already closed.
          </>
        )}
        {p.accelerator_style === 'rate_switch' && (
          <>
            {' '}
            <NumBlank id="th" label="Accelerator threshold" value={p.accelerator_threshold} money={arr} onChange={(n) => set('accelerator_threshold', n)} />
            {unit}, every deal from there pays{' '}
            <NumBlank id="arate" label="Accelerated rate" value={p.accelerator_rate} onChange={(n) => set('accelerator_rate', n)} />
            {percent ? '%' : ' months of MRR'}.
          </>
        )}
        {p.accelerator_style === 'none' && <> — the same rate all {noun}.</>}{' '}
        <label className="blank blank-check">
          <input
            type="checkbox"
            className="sr-only"
            checked={p.attach_enabled}
            onChange={(e) => set('attach_enabled', e.target.checked)}
          />
          <span className="check-glyph" aria-hidden="true" />
          <span className="sr-only">Per-unit add-on: </span>
          {p.attach_enabled ? 'Each unit can carry a' : 'No per-unit add-on.'}
        </label>
        {p.attach_enabled && (
          <>
            {' '}
            <TextBlank id="aname" label="Add-on name" value={p.attach_name} onChange={(v) => set('attach_name', v)} /> at{' '}
            <NumBlank id="amrr" label="Add-on price per unit, per month" value={p.attach_mrr} money onChange={(n) => set('attach_mrr', n)} /> a month.
          </>
        )}
      </p>

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
