'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_PLAN, type CompPlan } from '@/lib/calc';
import { fmt, periodNoun, planSentence } from '@/lib/format';
import { peekDemoState, clearDemoState } from '@/lib/demo';
import { importDemoPlanAction } from '@/app/actions';

/**
 * Shown above the blank plan form the first time a signed-in user with no
 * saved plan also has a customized demo sitting in this browser's
 * localStorage — otherwise signing in silently discards the two minutes
 * they spent shaping it on the demo. Only offers the plan: the demo's
 * seeded deals are scripted narrative, not the visitor's real commission
 * history, so there's nothing worth carrying over there.
 */
export default function ImportDemoPlan() {
  const router = useRouter();
  const [plan, setPlan] = useState<CompPlan | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = peekDemoState();
    if (s && JSON.stringify(s.plan) !== JSON.stringify(DEMO_PLAN)) setPlan(s.plan);
  }, []);

  if (!plan) return null;

  const noun = periodNoun(plan);
  const target =
    plan.quota_basis === 'arr'
      ? fmt(plan.quota)
      : `${plan.quota.toLocaleString('en-US')} unit${plan.quota === 1 ? '' : 's'}`;
  const summary = `${plan.role_name || 'Account Executive'} — ${target} ${noun}ly quota. ${planSentence(plan)}.`;

  async function onImport() {
    setPending(true);
    setError(null);
    const res = await importDemoPlanAction(plan!);
    if (res.error) {
      setError(res.error);
      setPending(false);
      return;
    }
    clearDemoState();
    router.refresh();
  }

  function onDismiss() {
    clearDemoState();
    setPlan(null);
  }

  return (
    <div className="import-banner">
      <p className="import-banner-title">We found the plan you set up before signing in.</p>
      <p className="import-banner-copy">{summary}</p>
      {error && <p className="plan-msg is-error">{error}</p>}
      <div className="import-banner-actions">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={onImport}>
          {pending ? 'Importing…' : 'Import it'}
        </button>
        <button type="button" className="btn-text" disabled={pending} onClick={onDismiss}>
          Start fresh instead
        </button>
      </div>
    </div>
  );
}
