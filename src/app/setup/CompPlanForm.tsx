'use client';

import { useActionState, useState } from 'react';
import { saveCompPlan, type SetupState } from './actions';
import { MARGINEDGE_DEFAULTS, type CompPlan } from '@/lib/calc';

const initial: SetupState = { error: null };

function Num({
  id,
  label,
  value,
  prefix,
  suffix,
  step = 1,
}: {
  id: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="input-row">
        {prefix && <span className="prefix">{prefix}</span>}
        <input id={id} name={id} className="num" type="number" min={0} step={step} defaultValue={value} required />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </div>
  );
}

export default function CompPlanForm({ plan }: { plan: CompPlan | null }) {
  const [state, action, pending] = useActionState(saveCompPlan, initial);
  // Preloaded with Bob's numbers so first-time setup is one click.
  const v = plan ?? MARGINEDGE_DEFAULTS;
  const [bonusBump, setBonusBump] = useState(v.accelerator_on_bonuses);

  return (
    <form action={action}>
      <div className="card">
        <div className="card-title">Your comp plan</div>
        {state.error && <div className="notice err">{state.error}</div>}

        <div className="field">
          <label className="label" htmlFor="role_name">
            Role name
          </label>
          <input id="role_name" name="role_name" className="txt" type="text" defaultValue={v.role_name} required />
        </div>

        <div className="grid-in">
          <Num id="quarterly_arr_quota" label="Quarterly ARR quota" value={v.quarterly_arr_quota} prefix="$" step={1000} />
          <Num id="commission_months" label="Months of SaaS per deal" value={v.commission_months} suffix="months" step={0.5} />
          <Num id="software_mrr" label="Software, per location" value={v.software_mrr} prefix="$" suffix="/mo" step={25} />
          <Num id="freepour_mrr" label="Freepour, per location" value={v.freepour_mrr} prefix="$" suffix="/mo" step={25} />
        </div>

        <div className="card-title" style={{ margin: '18px 0 12px' }}>Accelerator</div>
        <div className="grid-in">
          <Num id="accelerator_pct" label="Bump once quota is met" value={v.accelerator_pct} suffix="%" step={1} />
        </div>
        <div className="toggle-row">
          <div style={{ flex: 1 }}>
            <span className="toggle-name">Bump applies to package bonuses too</span>
            <span className="toggle-desc">
              Unconfirmed — ask Bob. Off means the {v.accelerator_pct}% applies to SaaS commission only.
            </span>
          </div>
          <button
            type="button"
            className={`toggle${bonusBump ? ' on' : ''}`}
            role="switch"
            aria-checked={bonusBump}
            aria-label="Accelerator applies to bonuses"
            onClick={() => setBonusBump(!bonusBump)}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <input type="hidden" name="accelerator_on_bonuses" value={String(bonusBump)} />

        <div className="card-title" style={{ margin: '18px 0 12px' }}>Onboarding package bonuses</div>
        <div className="grid-in three">
          <Num id="bonus_launch" label="Launch" value={v.bonus_launch} prefix="$" step={50} />
          <Num id="bonus_boost" label="Boost" value={v.bonus_boost} prefix="$" step={50} />
          <Num id="bonus_accelerate" label="Accelerate" value={v.bonus_accelerate} prefix="$" step={50} />
        </div>
        <div className="card-note">
          Mapping assumed by package price order — confirm with Bob which bonus goes with which package.
        </div>

        <button className="btn btn-primary btn-lg" type="submit" disabled={pending} style={{ marginTop: 18 }}>
          {pending ? 'Saving…' : plan ? 'Save changes' : 'Looks right — save my plan'}
        </button>
      </div>
    </form>
  );
}
