'use client';

import { useEffect } from 'react';
import type { CompPlan } from '@/lib/calc';
import PlanCapture from '@/components/capture/PlanCapture';

/**
 * Putting your plan in, over the deal instead of instead of it: the same
 * describe, check and confirm flow as the `/plan` page, with the same
 * `onSave` contract. Putting your plan in shouldn't cost you the deal you
 * were just looking at.
 */
export default function PlanDialog({
  onSave,
  onClose,
}: {
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
        <PlanCapture current={null} onSave={onSave} account={false} compact onDone={onClose} doneLabel="Back to your deal" />
      </div>
    </div>
  );
}
