'use client';

import { useEffect } from 'react';
import { DEMO_PLAN } from '@/lib/calc';
import { useDemoStore } from '@/lib/demo';
import { Shell } from '@/app/AccountViews';
import DealStage from '@/components/DealStage';
import QuotaView from '@/components/QuotaView';
import HistoryView from '@/components/HistoryView';
import PlanCapture from '@/components/capture/PlanCapture';
import HowItWorks from '@/components/HowItWorks';
import { ClosingCta, LandingHero } from '@/components/Landing';
import { OPENING_PTD, OPENING_QTD, SAMPLE } from '@/components/opening';

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
    // 5 current-month + 12 historical (seedQuarterHistory, demo.ts).
    const fresh = d.deals.length === 17 && JSON.stringify(d.plan) === JSON.stringify(DEMO_PLAN);
    if (fresh && JSON.stringify(d.ptd) !== JSON.stringify(OPENING_PTD)) {
      console.warn('IOI: OPENING_PTD no longer mirrors the seeded period in demo.ts', d.ptd);
    }
    if (fresh && JSON.stringify(d.qtd) !== JSON.stringify(OPENING_QTD)) {
      console.warn('IOI: OPENING_QTD no longer mirrors the seeded quarter in demo.ts', d.qtd);
    }
  }, [d.ready, d.deals.length, d.plan, d.ptd, d.qtd]);

  // A visitor with a plan of their own gets the tool, not the pitch: a plain
  // title over their deal, the builder, and no sales sections to scroll past.
  const pitch = d.seeded;

  return (
    <Shell current="/" email={null} width="full" own={d.ready && !d.seeded}>
      <DealStage
        plan={d.ready ? d.plan : DEMO_PLAN}
        ptd={d.ready ? d.ptd : OPENING_PTD}
        // The quarter too, or the first paint has no bonus line, bonus box or
        // story to tell, and they all arrive with a jump once the store loads.
        qtd={d.ready ? d.qtd : OPENING_QTD}
        demo
        onSave={d.saveDeal}
        onSavePlan={d.savePlan}
        onStartOver={d.reset}
        initialDeal={SAMPLE}
        intro={pitch ? <LandingHero /> : undefined}
        sample={d.seeded}
      />
      {pitch && <HowItWorks />}
      {pitch && <ClosingCta />}
    </Shell>
  );
}

export function DemoQuota() {
  const d = useDemoStore();
  return (
    <Shell current="/quota" email={null} width="narrow" own={d.ready && !d.seeded}>
      {/* d.seeded is false the instant savePlan() has ever succeeded, same
          "already made this connection" signal DealStage.tsx's own
          plan-bridges use (there, local planSaved state) — without it, this
          page kept inviting someone to "put your plan in" after they
          already had. */}
      {d.ready && <QuotaView plan={d.plan} ptd={d.ptd} deals={d.periodDeals} demo={d.seeded} />}
    </Shell>
  );
}

export function DemoHistory() {
  const d = useDemoStore();
  return (
    <Shell current="/history" email={null} width="table" own={d.ready && !d.seeded}>
      {d.ready && <HistoryView plan={d.plan} deals={d.deals} onDelete={d.deleteDeal} demo onReset={d.reset} />}
    </Shell>
  );
}

export function DemoPlan() {
  const d = useDemoStore();
  return (
    <Shell current="/plan" email={null} width="plan" own={d.ready && !d.seeded}>
      {/* The stock sample isn't anyone's plan: a visitor who hasn't put theirs
          in yet starts by describing it, not by editing the sample. */}
      {d.ready && <PlanCapture current={d.seeded ? null : d.plan} onSave={d.savePlan} account={false} />}
    </Shell>
  );
}
