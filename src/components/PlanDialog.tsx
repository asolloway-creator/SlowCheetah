'use client';

import { useEffect } from 'react';
import type { CompPlan } from '@/lib/calc';
import PlanSentence from '@/components/PlanSentence';

/**
 * The plan form, over the deal instead of instead of it. Same component,
 * same `onSave` contract as the full `/plan` page — putting your plan in
 * shouldn't cost you the deal you were just looking at. Compact: shape, then
 * only the numbers that differ by shape — a full settings form defeats the
 * point of putting this in the header as the one quick thing to do.
 */
export default function PlanDialog({
  plan,
  onSave,
  onClose,
}: {
  plan: CompPlan;
  onSave: (p: CompPlan) => Promise<{ error?: string }>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Put your plan in"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
          &times;
        </button>
        <PlanSentence plan={plan} demo onSave={onSave} compact />
      </div>
    </div>
  );
}
