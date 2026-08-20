'use client';

import { useActionState } from 'react';
import { saveCompPlan, type SetupState } from './actions';
import type { CompPlan } from '@/lib/calc';

const initial: SetupState = { error: null };

export default function CompPlanForm({ plan }: { plan: CompPlan | null }) {
  const [state, action, pending] = useActionState(saveCompPlan, initial);

  return (
    <form action={action}>
      <div className="card">
        <div className="card-title">Your comp plan</div>
        {state.error && <div className="notice err">{state.error}</div>}

        <div className="field">
          <label className="label" htmlFor="role_name">
            Role name
          </label>
          <input
            id="role_name"
            name="role_name"
            className="txt"
            type="text"
            defaultValue={plan?.role_name ?? ''}
            placeholder="Account Executive"
            required
          />
        </div>

        <div className="grid-in">
          <div className="field">
            <label className="label" htmlFor="monthly_unit_quota">
              Monthly unit quota
            </label>
            <div className="input-row">
              <input
                id="monthly_unit_quota"
                name="monthly_unit_quota"
                className="num"
                type="number"
                min={1}
                step={1}
                defaultValue={plan?.monthly_unit_quota ?? ''}
                required
              />
              <span className="suffix">units</span>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="accelerator_threshold">
              Accelerator threshold
            </label>
            <div className="input-row">
              <input
                id="accelerator_threshold"
                name="accelerator_threshold"
                className="num"
                type="number"
                min={1}
                step={1}
                defaultValue={plan?.accelerator_threshold ?? ''}
                required
              />
              <span className="suffix">units</span>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="base_rate">
              Base rate
            </label>
            <div className="input-row">
              <input
                id="base_rate"
                name="base_rate"
                className="num"
                type="number"
                min={0}
                max={100}
                step={0.1}
                defaultValue={plan?.base_rate ?? ''}
                required
              />
              <span className="suffix">%</span>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="accelerator_rate">
              Accelerator rate
            </label>
            <div className="input-row">
              <input
                id="accelerator_rate"
                name="accelerator_rate"
                className="num"
                type="number"
                min={0}
                max={100}
                step={0.1}
                defaultValue={plan?.accelerator_rate ?? ''}
                required
              />
              <span className="suffix">%</span>
            </div>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="monthly_arr_quota">
            Monthly new-ARR quota (optional)
          </label>
          <div className="input-row">
            <span className="prefix">$</span>
            <input
              id="monthly_arr_quota"
              name="monthly_arr_quota"
              className="num"
              type="number"
              min={0}
              step={1000}
              defaultValue={plan?.monthly_arr_quota ?? ''}
              placeholder="leave blank if you don't carry one"
            />
          </div>
        </div>

        <div className="card-note" style={{ marginTop: 4 }}>
          Rates apply to the whole deal: every deal earns the base rate until you hit
          the accelerator threshold for the month, then every deal earns the
          accelerator rate. If your own plan works differently — tiered brackets, a
          flat rate with no accelerator, rates that vary by product — say so and the
          engine gets reshaped to match it.
        </div>

        <button
          className="btn btn-primary btn-lg"
          type="submit"
          disabled={pending}
          style={{ marginTop: 18 }}
        >
          {pending ? 'Saving…' : plan ? 'Save changes' : 'Save comp plan'}
        </button>
      </div>
    </form>
  );
}
