'use client';

import { DEMO_PLAN } from '@/lib/calc';
import { useDemoStore } from '@/lib/demo';
import { Shell } from '@/app/AccountViews';
import DealStage from '@/components/DealStage';
import QuotaView from '@/components/QuotaView';
import HistoryView from '@/components/HistoryView';
import PlanCapture from '@/components/capture/PlanCapture';
import HowItWorks from '@/components/HowItWorks';
import PlanFirst from '@/components/PlanFirst';
import { ClosingCta, LandingHero } from '@/components/Landing';
import { OPENING_PTD, OPENING_QTD, SAMPLE } from '@/components/opening';

/**
 * Demo mode: the whole app against the visitor's browser. The stage renders
 * the sample's fixed position (OPENING_PTD/OPENING_QTD) before the store is
 * ready, so the first paint is the same frame a fresh visitor hydrates into.
 */
export function DemoDeal() {
  const d = useDemoStore();

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
        onSaveOpening={d.setOpening}
        onStartOver={d.reset}
        quotes={d.quotes}
        onSaveQuote={d.saveQuote}
        onDeleteQuote={d.deleteQuote}
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
      {d.ready &&
        (d.seeded ? (
          <PlanFirst page="quota" />
        ) : (
          <QuotaView
            plan={d.plan}
            ptd={d.ptd}
            qtd={d.qtd}
            deals={d.periodDeals}
            opening={d.opening}
            onOpening={d.setOpening}
          />
        ))}
    </Shell>
  );
}

export function DemoHistory() {
  const d = useDemoStore();
  return (
    <Shell current="/history" email={null} width="table" own={d.ready && !d.seeded}>
      {d.ready && (d.seeded ? <PlanFirst page="history" /> : <HistoryView plan={d.plan} deals={d.deals} onDelete={d.deleteDeal} demo />)}
    </Shell>
  );
}

export function DemoPlan() {
  const d = useDemoStore();
  return (
    <Shell current="/plan" email={null} width="plan" own={d.ready && !d.seeded}>
      {/* The stock sample isn't anyone's plan: a visitor who hasn't put theirs
          in yet starts by describing it, not by editing the sample. */}
      {d.ready && <PlanCapture current={d.seeded ? null : d.plan} onSave={d.savePlan} onOpening={d.setOpening} account={false} />}
    </Shell>
  );
}
