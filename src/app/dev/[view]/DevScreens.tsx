'use client';

import {
  calc,
  calendarInZone,
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

/** A monthly plan with a retroactive accelerator and a quarterly bonus in
 *  fixed tiers: the shape a rate adjustment and month pacing matter on. */
const RETRO: CompPlan = {
  role_name: 'Account Executive', period: 'month', quota_basis: 'arr', quota: 60000, commission_style: 'percent',
  base_rate: 8, accelerator_style: 'retro_bump', accelerator_threshold: 60000, accelerator_rate: 25,
  one_time_weight: 33.3, hardware_rate: null,
  quarterly_kicker: { target: 180000, tiers: [{ attainmentPct: 105, kickerPct: 0, amount: 7500 }, { attainmentPct: 140, kickerPct: 0, amount: 15000 }] },
  industry: null, company_size_band: null,
};

const day = (n: number) => new Date(Date.now() - n * 86400000);
const deal = (annual: number, off = 0, hardware = 0): DealInput => ({
  oneTime: 2000, subscription: annual, subMode: 'acv', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: off, hardware, hardwareDiscountPct: 0,
});

function rows(opening: Opening | null, plan: CompPlan = PLAN): DealRow[] {
  const PLAN = plan;
  const out: DealRow[] = [];
  let ptd = withPeriodOpening(PLAN, periodToDateFrom([]), opening, periodKey(PLAN.period));
  [[{ ...deal(24000, 10, 3000), oneTimeDiscountPct: 25 }, 9], [deal(18000, 0), 4]].forEach(([d, ago], i) => {
    const r = calc(PLAN, d as DealInput, ptd);
    const row: DealRow = {
      id: `dev-${i}`, one_time_amount: (d as DealInput).oneTime, subscription_amount: (d as DealInput).subscription, subscription_mode: 'acv', units: 1,
      one_time_discount_pct: (d as DealInput).oneTimeDiscountPct, subscription_discount_pct: (d as DealInput).subscriptionDiscountPct, quota_credit: r.credit, arr: r.subAnnual,
      commission_base: r.commissionBase, commission_earned: r.commissionEffective, money_left_on_table: r.lost, saas_commission: r.saasCommissionEffective,
      hardware_amount: (d as DealInput).hardware, hardware_discount_pct: 0, hardware_commission: r.hardwareCommission, created_at: day(ago as number).toISOString(),
      name: i === 0 ? 'Harbor Grill' : '',
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

  if (view === 'home-retro') {
    const plan = RETRO;
    const o: Opening = { periodKey: periodKey('month'), credit: 0, quarterKey: periodKey('quarter'), quarterArr: null, rateAdjust: 1 };
    const rr = rows(null, plan);
    return (
      <Shell current="/" email={EMAIL} width="full">
        <PipelineHome
          plan={plan}
          ptd={periodToDateFrom(rr)}
          qtd={quarterToDateFrom(rr)}
          opening={o}
          quotes={[]}
          deals={rr}
          onSave={ok}
          onSaveQuote={async () => ({ id: 'q1' })}
          onDeleteQuote={ok}
          onDeleteDeal={ok}
          onOpening={ok}
          onUpdateDeal={ok}
          onRate={ok}
          calendar={calendarInZone('month', 'America/New_York')}
        />
      </Shell>
    );
  }
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
          onUpdateDeal={ok}
          onRate={ok}
          calendar={calendarInZone(PLAN.period, 'America/New_York')}
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
