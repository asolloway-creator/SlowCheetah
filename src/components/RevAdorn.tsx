'use client';

/**
 * ARR | MRR inside a money field, the way % | $ sits in a discount field:
 * the rep types the number in whichever unit they have in front of them.
 * The field converts; what's saved is always ARR.
 */
export default function RevAdorn({ unit, onUnit }: { unit: 'arr' | 'mrr'; onUnit: (u: 'arr' | 'mrr') => void }) {
  return (
    <span className="disc-mode is-words" role="group" aria-label="Type it as">
      <button type="button" aria-pressed={unit === 'arr'} aria-label="ARR, a year" onClick={() => onUnit('arr')}>
        ARR
      </button>
      <button type="button" aria-pressed={unit === 'mrr'} aria-label="MRR, a month" onClick={() => onUnit('mrr')}>
        MRR
      </button>
    </span>
  );
}
