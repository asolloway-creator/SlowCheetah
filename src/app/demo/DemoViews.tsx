'use client';

import { useDemoStore } from '@/lib/demo';
import Masthead from '@/components/Masthead';
import Hero from '@/components/Hero';
import Footnote from '@/components/Footnote';
import DealBuilder from '@/components/DealBuilder';
import QuotaView from '@/components/QuotaView';
import HistoryView from '@/components/HistoryView';
import CompPlanForm from '@/components/CompPlanForm';

function Shell({ current, children }: { current: string; children: React.ReactNode }) {
  return (
    <div className="app">
      <Masthead current={current} email={null} />
      {children}
      <Footnote />
    </div>
  );
}

export function DemoDeal() {
  const d = useDemoStore();
  return (
    <Shell current="/">
      <Hero />
      {d.ready && <DealBuilder plan={d.plan} ptd={d.ptd} demo onSave={d.saveDeal} />}
    </Shell>
  );
}

export function DemoQuota() {
  const d = useDemoStore();
  return <Shell current="/quota">{d.ready && <QuotaView plan={d.plan} ptd={d.ptd} deals={d.periodDeals} />}</Shell>;
}

export function DemoHistory() {
  const d = useDemoStore();
  return (
    <Shell current="/history">
      {d.ready && <HistoryView plan={d.plan} deals={d.deals} onDelete={d.deleteDeal} />}
      {d.ready && (
        <div className="card-note" style={{ textAlign: 'center', marginTop: 14 }}>
          Demo data lives in this browser. <button className="link-btn" type="button" onClick={d.reset}>Reset the sample quarter</button>
        </div>
      )}
    </Shell>
  );
}

export function DemoPlan() {
  const d = useDemoStore();
  return (
    <Shell current="/plan">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div className="notice info">You&rsquo;re editing the demo plan. Pick a shape that looks like yours, put in your numbers, and every deal recalculates. Sign in to keep it.</div>
        {d.ready && <CompPlanForm plan={d.plan} demo onSave={d.savePlan} />}
      </div>
    </Shell>
  );
}
