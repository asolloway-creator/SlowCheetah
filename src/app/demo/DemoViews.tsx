'use client';

import { useEffect } from 'react';
import { DEMO_PLAN } from '@/lib/calc';
import { useDemoStore } from '@/lib/demo';
import { Shell } from '@/app/AccountViews';
import DealStage from '@/components/DealStage';
import QuotaView from '@/components/QuotaView';
import HistoryView from '@/components/HistoryView';
import PlanSentence from '@/components/PlanSentence';
import { OPENING_PTD, SAMPLE } from '@/components/opening';

/**
 * Demo mode: the whole app against the visitor's browser. The stage renders
 * the opening frame from OPENING_PTD before the store is ready, so the first
 * paint is the Moment's before-state — byte-identical to the hydrated state
 * for a fresh visitor.
 */
export function DemoDeal() {
  const d = useDemoStore();

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !d.ready) return;
    const fresh = d.deals.length === 5 && JSON.stringify(d.plan) === JSON.stringify(DEMO_PLAN);
    if (fresh && JSON.stringify(d.ptd) !== JSON.stringify(OPENING_PTD)) {
      console.warn('IOI: OPENING_PTD no longer mirrors the seeded period in demo.ts', d.ptd);
    }
  }, [d.ready, d.deals.length, d.plan, d.ptd]);

  return (
    <Shell current="/" email={null}>
      <h1 className="headline">See the whole deal before the offer is made.</h1>
      <DealStage
        plan={d.ready ? d.plan : DEMO_PLAN}
        ptd={d.ready ? d.ptd : OPENING_PTD}
        demo
        onSave={d.saveDeal}
        onStartOver={d.reset}
        initialDeal={SAMPLE}
      />
    </Shell>
  );
}

export function DemoQuota() {
  const d = useDemoStore();
  return (
    <Shell current="/quota" email={null} width="narrow">
      {d.ready && <QuotaView plan={d.plan} ptd={d.ptd} deals={d.periodDeals} />}
    </Shell>
  );
}

export function DemoHistory() {
  const d = useDemoStore();
  return (
    <Shell current="/history" email={null} width="table">
      {d.ready && <HistoryView plan={d.plan} deals={d.deals} onDelete={d.deleteDeal} demo onReset={d.reset} />}
    </Shell>
  );
}

export function DemoPlan() {
  const d = useDemoStore();
  return (
    <Shell current="/plan" email={null} width="plan">
      {d.ready && <PlanSentence plan={d.plan} demo onSave={d.savePlan} />}
    </Shell>
  );
}
