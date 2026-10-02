'use client';

import { needsQuarterArr, periodLabel, type CompPlan } from '@/lib/calc';
import NumField from '@/components/NumField';

/**
 * Where a rep already stands this period, in the plan's own measure: units
 * or new ARR booked so far, and the quarter's new ARR when a quarterly bonus
 * needs it asked separately (needsQuarterArr). Controlled; the parent saves.
 */
export default function OpeningFields({
  plan,
  credit,
  quarterArr,
  onCredit,
  onQuarterArr,
  idPrefix = 'opening',
}: {
  plan: CompPlan;
  credit: number;
  quarterArr: number;
  onCredit: (n: number) => void;
  onQuarterArr: (n: number) => void;
  idPrefix?: string;
}) {
  const units = plan.quota_basis === 'units';
  return (
    <div className="field-grid opening-fields">
      <NumField
        id={`${idPrefix}-credit`}
        label={`${units ? 'Units' : 'New ARR'} booked so far in ${periodLabel(plan.period)}`}
        prefix={units ? undefined : '$'}
        integer={units}
        value={credit}
        onChange={onCredit}
      />
      {needsQuarterArr(plan) && (
        <div>
          <NumField
            id={`${idPrefix}-quarter`}
            label={`New ARR booked so far in ${periodLabel('quarter')}`}
            prefix="$"
            value={quarterArr}
            onChange={onQuarterArr}
          />
          <p className="field-note">For your Quarterly Bonus.</p>
        </div>
      )}
    </div>
  );
}
