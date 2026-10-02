'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { currentOpening, DEMO_PLAN, periodKey, type CompPlan, type OpeningInput } from '@/lib/calc';
import { fmt, periodNoun, planSentence } from '@/lib/format';
import { peekDemoState, clearDemoState, demoDealsForImport } from '@/lib/demo';
import { importDemoPlanAction } from '@/app/actions';

function customizedDemoPlan(): CompPlan | null {
  const s = peekDemoState();
  return s && !s.seeded && JSON.stringify(s.plan) !== JSON.stringify(DEMO_PLAN) ? s.plan : null;
}

/** The starting point they gave in the demo, while it still applies. */
function demoOpening(): OpeningInput | null {
  const s = peekDemoState();
  const o = s && !s.seeded ? currentOpening(s.opening ?? null, periodKey(s.plan.period)) : null;
  return o ? { credit: o.credit, quarterArr: o.quarterArr } : null;
}

/**
 * Shown above the blank plan form the first time a signed-in user with no
 * saved plan also has a plan of their own sitting in this browser's
 * localStorage — otherwise signing in silently discards what they set up
 * before it. Carries over the plan, their starting point for this period and
 * the deals they booked (re-run on the server, see importDemoPlanAction).
 */
export default function ImportDemoPlan() {
  const router = useRouter();
  // Lazy initializer, not an effect: it runs during the client's first
  // render (including hydration), so the banner is correct on the very
  // first paint instead of popping in a tick after mount. Server-side it
  // safely returns null — `peekDemoState` swallows the ReferenceError from
  // `localStorage` not existing in Node.
  const [plan, setPlan] = useState<CompPlan | null>(customizedDemoPlan);
  const [deals] = useState(demoDealsForImport);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plan) return null;

  const noun = periodNoun(plan);
  const target =
    plan.quota_basis === 'arr'
      ? fmt(plan.quota)
      : `${plan.quota.toLocaleString('en-US')} unit${plan.quota === 1 ? '' : 's'}`;
  const summary = `${plan.role_name || 'Account Executive'} with a ${noun}ly quota of ${target}. ${planSentence(plan)}.`;

  async function onImport() {
    setPending(true);
    setError(null);
    const res = await importDemoPlanAction(plan!, demoOpening(), deals);
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
      <p className="import-banner-title">
        {deals.length > 0
          ? `We found the plan and ${deals.length} deal${deals.length === 1 ? '' : 's'} you set up before signing in.`
          : 'We found the plan you set up before signing in.'}
      </p>
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
