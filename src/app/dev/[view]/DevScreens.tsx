'use client';

import {
  calc,
  periodKey,
  periodToDateFrom,
  quarterToDateFrom,
  withPeriodOpening,
  withQuarterOpening,
  type CompPlan,
  type DealInput,
  type Opening,
  type Quote,
} from '@/lib/calc';
import type { DealRow } from '@/lib/queries';
import { Shell } from '@/app/AccountViews';
import PipelineHome from '@/components/PipelineHome';
import PlanCapture from '@/components/capture/PlanCapture';

const ok = async () => ({});
const EMAIL = 'rep@example.com';

/** The October tester's plan. */
const PLAN: CompPlan = {
  role_name: 'Account Executive', period: 'quarter', quota_basis: 'arr', quota: 150000, commission_style: 'percent',
  base_rate: 8, accelerator_style: 'rate_switch', accelerator_threshold: 150000, accelerator_rate: 12,
  accelerator_steps: [{ threshold: 187500, rate: 15 }], one_time_weight: 50, hardware_rate: 3,
  quarterly_kicker: { target: 150000, tiers: [{ attainmentPct: 100, kickerPct: 0, amount: 9000 }] },
  industry: null, company_size_band: null,
};

const day = (n: number) => new Date(Date.now() - n * 86400000);
const deal = (annual: number, off = 0, hardware = 0): DealInput => ({
  oneTime: 2000, subscription: annual, subMode: 'acv', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: off, hardware, hardwareDiscountPct: 0,
});

function rows(opening: Opening | null): DealRow[] {
  const out: DealRow[] = [];
  let ptd = withPeriodOpening(PLAN, periodToDateFrom([]), opening, periodKey(PLAN.period));
  [[deal(24000, 10, 3000), 9], [deal(18000, 0), 4]].forEach(([d, ago], i) => {
    const r = calc(PLAN, d as DealInput, ptd);
    const row: DealRow = {
      id: `dev-${i}`, one_time_amount: (d as DealInput).oneTime, subscription_amount: (d as DealInput).subscription, subscription_mode: 'acv', units: 1,
      one_time_discount_pct: 0, subscription_discount_pct: (d as DealInput).subscriptionDiscountPct, quota_credit: r.credit, arr: r.subAnnual,
      commission_base: r.commissionBase, commission_earned: r.commissionEffective, money_left_on_table: r.lost, saas_commission: r.saasCommissionEffective,
      hardware_amount: (d as DealInput).hardware, hardware_discount_pct: 0, hardware_commission: r.hardwareCommission, created_at: day(ago as number).toISOString(),
    };
    out.unshift(row);
    ptd = { ...ptd, creditBooked: ptd.creditBooked + r.credit, commissionBooked: ptd.commissionBooked + r.commissionBase, earnedBooked: ptd.earnedBooked + r.commissionEffective };
  });
  return out;
}

export default function DevScreens({ view }: { view: string }) {
  const opening: Opening | null =
    view === 'stand' ? null : { periodKey: periodKey(PLAN.period), credit: 98000, quarterKey: periodKey('quarter'), quarterArr: null };
  const deals = rows(opening);
  const ptd = withPeriodOpening(PLAN, periodToDateFrom(deals), opening, periodKey(PLAN.period));
  const qtd = withQuarterOpening(PLAN, quarterToDateFrom(deals), opening, periodKey('quarter'));
  const quotes: Quote[] = [
    { id: 'q1', name: 'Q4 expansion', deal: deal(9000), createdAt: day(2).toISOString(), updatedAt: day(1).toISOString() },
  ];

  if (view === 'home' || view === 'home-new') {
    return (
      <Shell current="/" email={EMAIL} width="full">
        <PipelineHome
          plan={PLAN}
          ptd={ptd}
          qtd={qtd}
          opening={view === 'home-new' ? null : opening}
          quotes={view === 'home-new' ? [] : quotes}
          deals={view === 'home-new' ? [] : deals}
          onSave={ok}
          onSaveQuote={async () => ({ id: 'q1' })}
          onDeleteQuote={ok}
          onDeleteDeal={ok}
          onOpening={ok}
        />
      </Shell>
    );
  }
  if (view === 'plan' || view === 'plan-new') {
    return (
      <Shell current="/plan" email={EMAIL} width="plan">
        <PlanCapture current={view === 'plan' ? PLAN : null} onSave={ok} onOpening={ok} account />
      </Shell>
    );
  }
  return null;
}
