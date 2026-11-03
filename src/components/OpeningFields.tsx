'use client';

import { useState } from 'react';
import { needsQuarterArr, periodLabel, type CompPlan } from '@/lib/calc';
import { revUnit } from '@/lib/format';
import NumField from '@/components/NumField';
import RevAdorn from '@/components/RevAdorn';

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
  // Typed as ARR or MRR (the rep's own unit to start); saved as ARR.
  const [unit, setUnit] = useState(revUnit(plan));
  const k = unit === 'mrr' ? 12 : 1;
  const word = unit === 'mrr' ? 'MRR' : 'ARR';
  const adorn = <RevAdorn unit={unit} onUnit={setUnit} />;
  return (
    <div className="field-grid opening-fields">
      <NumField
        id={`${idPrefix}-credit`}
        label={`${units ? 'Units' : `New ${word}`} booked so far in ${periodLabel(plan.period)}`}
        prefix={units ? undefined : '$'}
        integer={units}
        value={units ? credit : credit / k}
        onChange={(n) => onCredit(units ? n : n * k)}
        adorn={units ? undefined : adorn}
      />
      {needsQuarterArr(plan) && (
        <div>
          <NumField
            id={`${idPrefix}-quarter`}
            label={`New ${word} booked so far in ${periodLabel('quarter')}`}
            prefix="$"
            value={quarterArr / k}
            onChange={(n) => onQuarterArr(n * k)}
            adorn={adorn}
          />
          <p className="field-note">For your Quarterly Bonus.</p>
        </div>
      )}
    </div>
  );
}
