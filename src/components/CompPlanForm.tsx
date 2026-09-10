'use client';

import { useState } from 'react';
import { PRESETS, type CompPlan } from '@/lib/calc';

function Num({ id, label, value, onChange, prefix, suffix, step = 1 }: {
  id: string; label: string; value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; step?: number;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="input-row">
        {prefix && <span className="prefix">{prefix}</span>}
        <input id={id} className="num" type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg seg-lg">
      {options.map(([v, l]) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export default function CompPlanForm({ plan, demo, onSave }: { plan: CompPlan | null; demo: boolean; onSave: (p: CompPlan) => Promise<{ error?: string }> }) {
  const [p, setP] = useState<CompPlan>(plan ?? PRESETS[0].plan);
  const [preset, setPreset] = useState<string | null>(plan ? null : PRESETS[0].id);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const set = <K extends keyof CompPlan>(k: K, v: CompPlan[K]) => { setPreset(null); setP((x) => ({ ...x, [k]: v })); };

  const isArr = p.quota_basis === 'arr';
  const retro = p.accelerator_style === 'retro_bump';
  const rateSuffix = p.commission_style === 'percent' ? '%' : 'months of MRR';

  async function submit() {
    setPending(true); setMsg({});
    const res = await onSave(p);
    setPending(false);
    setMsg(res.error ? { error: res.error } : { ok: demo ? 'Plan applied to this browser.' : 'Plan saved.' });
  }

  return (
    <div className="card">
      <div className="card-title">Start from a plan shape</div>
      <div className="preset-grid">
        {PRESETS.map((x) => (
          <button key={x.id} type="button" className={`preset${preset === x.id ? ' on' : ''}`} onClick={() => { setP(x.plan); setPreset(x.id); }}>
            <span className="preset-name">{x.name}</span>
            <span className="preset-blurb">{x.blurb}</span>
          </button>
        ))}
      </div>

      <div className="card-title" style={{ margin: '22px 0 12px' }}>Your numbers</div>
      {msg.error && <div className="notice err">{msg.error}</div>}
      {msg.ok && <div className="notice ok">{msg.ok}</div>}

      <div className="field">
        <label className="label" htmlFor="role_name">Role name</label>
        <input id="role_name" className="txt" type="text" value={p.role_name} onChange={(e) => set('role_name', e.target.value)} />
      </div>

      <div className="grid-in">
        <div className="field"><span className="label">Quota period</span>
          <Seg value={p.period} options={[['month', 'Monthly'], ['quarter', 'Quarterly']]} onChange={(v) => set('period', v)} /></div>
        <div className="field"><span className="label">Quota measured in</span>
          <Seg value={p.quota_basis} options={[['units', 'Units'], ['arr', 'New ARR $']]} onChange={(v) => set('quota_basis', v)} /></div>
        <Num id="quota" label={`Quota per ${p.period}`} value={p.quota} onChange={(n) => set('quota', n)} prefix={isArr ? '$' : undefined} suffix={isArr ? undefined : 'units'} step={isArr ? 1000 : 1} />
      </div>

      <div className="card-title" style={{ margin: '18px 0 12px' }}>Commission</div>
      <div className="grid-in">
        <div className="field"><span className="label">Paid as</span>
          <Seg value={p.commission_style} options={[['percent', '% of deal value'], ['months_of_mrr', 'Months of MRR']]} onChange={(v) => set('commission_style', v)} /></div>
        <Num id="base_rate" label="Base rate" value={p.base_rate} onChange={(n) => set('base_rate', n)} suffix={rateSuffix} step={p.commission_style === 'percent' ? 0.5 : 0.5} />
        {p.commission_style === 'percent' && (
          <>
            <Num id="one_time_weight" label="One-time products count at" value={p.one_time_weight} onChange={(n) => set('one_time_weight', n)} suffix="%" step={5} />
            <Num id="implementation_weight" label="Implementation counts at" value={p.implementation_weight} onChange={(n) => set('implementation_weight', n)} suffix="%" step={5} />
          </>
        )}
      </div>

      <div className="card-title" style={{ margin: '18px 0 12px' }}>Accelerator</div>
      <div className="field"><span className="label">Style</span>
        <Seg value={p.accelerator_style} options={[['none', 'None'], ['rate_switch', 'Rate switches at a threshold'], ['retro_bump', '% bump, retroactive on the period']]} onChange={(v) => set('accelerator_style', v)} /></div>
      {p.accelerator_style !== 'none' && (
        <div className="grid-in">
          <Num id="accelerator_threshold" label="Kicks in at" value={p.accelerator_threshold} onChange={(n) => set('accelerator_threshold', n)} prefix={isArr ? '$' : undefined} suffix={isArr ? undefined : 'units'} step={isArr ? 1000 : 1} />
          <Num id="accelerator_rate" label={retro ? 'Bump on everything closed' : 'Accelerated rate'} value={p.accelerator_rate} onChange={(n) => set('accelerator_rate', n)} suffix={retro ? '%' : rateSuffix} step={0.5} />
        </div>
      )}
      <div className="card-note">
        {p.accelerator_style === 'rate_switch' && 'Once the threshold lands, every deal from that one on earns the accelerated rate. Earlier deals keep the base rate.'}
        {p.accelerator_style === 'retro_bump' && `Once the threshold lands, the bump applies to every deal in the ${p.period} — including the ones already closed.`}
        {p.accelerator_style === 'none' && 'Same rate on every deal. Quota is still tracked.'}
      </div>

      <div className="card-title" style={{ margin: '18px 0 12px' }}>Attach product</div>
      <div className="toggle-row">
        <div style={{ flex: 1 }}><span className="toggle-name">Per-unit add-on on deals</span><span className="toggle-desc">Hardware, a module, a scale — priced monthly per unit, counted in MRR and quota.</span></div>
        <button type="button" className={`toggle${p.attach_enabled ? ' on' : ''}`} role="switch" aria-checked={p.attach_enabled} aria-label="Attach product enabled" onClick={() => set('attach_enabled', !p.attach_enabled)}><span className="toggle-knob" /></button>
      </div>
      {p.attach_enabled && (
        <div className="grid-in">
          <div className="field"><label className="label" htmlFor="attach_name">Name</label>
            <input id="attach_name" className="txt" type="text" value={p.attach_name} onChange={(e) => set('attach_name', e.target.value)} placeholder="Hardware add-on" /></div>
          <Num id="attach_mrr" label="Price per unit" value={p.attach_mrr} onChange={(n) => set('attach_mrr', n)} prefix="$" suffix="/mo" step={25} />
        </div>
      )}

      <button className="btn btn-primary btn-lg" type="button" disabled={pending} onClick={submit} style={{ marginTop: 18 }}>
        {pending ? 'Saving…' : demo ? 'Apply to the demo' : plan ? 'Save changes' : 'Save my plan'}
      </button>
    </div>
  );
}
