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
      name: i === 0 ? 'Harbor Grill Annapolis' : 'Northside Coffee Co',
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

  if (view === 'home-recap') {
    // A month that just started: last month's deals and the month before,
    // and two open quotes, so the recap, earlier months and quick Won/Lost show.
    const plan = RETRO;
    const now = new Date();
    const at = (monthsBack: number, day: number) => new Date(now.getFullYear(), now.getMonth() - monthsBack, day, 12).toISOString();
    const mk = (id: string, name: string, when: string, annual: number, subOff: number, ot: number, otOff: number): DealRow => {
      const d: DealInput = { oneTime: ot, subscription: annual, subMode: 'acv', units: 1, oneTimeDiscountPct: otOff, subscriptionDiscountPct: subOff, hardware: 0, hardwareDiscountPct: 0 };
      const r = calc(plan, d, periodToDateFrom([]));
      return {
        id, name, created_at: when, one_time_amount: ot, subscription_amount: annual, subscription_mode: 'acv', units: 1,
        one_time_discount_pct: otOff, subscription_discount_pct: subOff, quota_credit: r.credit, arr: r.subAnnual,
        commission_base: r.commissionBase, commission_earned: r.commissionEffective, money_left_on_table: r.lost,
        saas_commission: r.saasCommissionEffective, hardware_amount: 0, hardware_discount_pct: 0, hardware_commission: 0,
      };
    };
    const deals = [
      mk('a1', 'Harbor Grill', at(0, 1), 14000, 10, 4000, 80),
      mk('b1', 'Harbor Grill Annapolis', at(1, 24), 21600, 15, 6000, 90),
      mk('b2', 'Northside Coffee Co', at(1, 12), 18000, 20, 5000, 95),
      mk('c1', 'Copper Pot', at(2, 20), 16000, 25, 6000, 98),
      mk('c2', 'Juniper Hall', at(2, 8), 12000, 30, 4000, 100),
    ];
    const cur = deals.filter((d) => new Date(d.created_at).getMonth() === now.getMonth());
    const quotes: Quote[] = [
      { id: 'q1', name: 'Saltwater Kitchen', deal: deal(9060, 21.6), createdAt: day(16).toISOString(), updatedAt: day(2).toISOString() },
      { id: 'q2', name: 'Maple and Rye Fairfax', deal: deal(9060), createdAt: day(0).toISOString(), updatedAt: day(0).toISOString() },
    ];
    const cal = calendarInZone('month', 'America/New_York');
    return (
      <Shell current="/" email={EMAIL} width="full">
        <PipelineHome
          plan={plan}
          ptd={periodToDateFrom(cur)}
          qtd={quarterToDateFrom(deals)}
          opening={null}
          quotes={quotes}
          deals={deals}
          onSave={ok}
          onSaveQuote={async () => ({ id: 'q9' })}
          onDeleteQuote={ok}
          onLoseQuotes={ok}
          onDeleteDeal={ok}
          onUnbookDeal={async () => ({ id: 'q8' })}
          onOpening={ok}
          onUpdateDeal={ok}
          onRate={ok}
          calendar={{ ...cal, today: cal.periodStart.replace(/-01$/, '-03') }}
          targets={{ software: 15, services: 75 }}
          onTarget={ok}
        />
      </Shell>
    );
  }
  if (view === 'home-close') {
    // The last days of a month: booked deals short of quota, open quotes
    // including one account that decides as one and one that doesn't, and
    // calls on some of them. Invented names and numbers.
    const plan = RETRO;
    const rr = rows(null, plan);
    const cal = calendarInZone('month', 'America/New_York');
    const [y, m] = cal.periodStart.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const today = `${cal.periodStart.slice(0, 8)}${String(last - 2).padStart(2, '0')}`;
    const mrr = (sub: number, off: number, ot = 3000, otOff = 90): DealInput => ({
      oneTime: ot, subscription: sub, subMode: 'mrr', units: 1, oneTimeDiscountPct: otOff, subscriptionDiscountPct: off,
    });
    const at = (n: number) => `${today}T1${n}:00:00Z`;
    const quotes: Quote[] = [
      { id: 'k1', name: 'Copper Pot', deal: mrr(1050, 10, 3900, 50), createdAt: at(6), updatedAt: at(6), accountId: null, forecast: 'commit' },
      { id: 'k2', name: 'Blue Fern', deal: mrr(200, 0), createdAt: at(5), updatedAt: at(5), accountId: null, forecast: 'stretch' },
      { id: 'k3', name: 'Juniper Hall Downtown', deal: mrr(950, 30), createdAt: at(4), updatedAt: at(4), accountId: 'acc-1', forecast: 'stretch' },
      { id: 'k4', name: 'Juniper Hall Midtown', deal: mrr(500, 15), createdAt: at(3), updatedAt: at(3), accountId: 'acc-1', forecast: 'stretch' },
      { id: 'k5', name: 'Juniper Hall Uptown', deal: mrr(1150, 35), createdAt: at(2), updatedAt: at(2), accountId: 'acc-1', forecast: 'stretch' },
      { id: 'k6', name: 'Maple and Rye Fairfax', deal: mrr(430, 20), createdAt: at(1), updatedAt: at(1), accountId: 'acc-2', forecast: null },
      { id: 'k7', name: 'Maple and Rye Vienna', deal: mrr(430, 20), createdAt: at(0), updatedAt: at(0), accountId: 'acc-2', forecast: 'next' },
    ];
    const accounts = [
      { id: 'acc-1', name: 'Juniper Hall', oneDecision: true },
      { id: 'acc-2', name: 'Maple and Rye', oneDecision: false },
    ];
    return (
      <Shell current="/" email={EMAIL} width="full">
        <PipelineHome
          plan={plan}
          ptd={periodToDateFrom(rr)}
          qtd={quarterToDateFrom(rr)}
          opening={null}
          quotes={quotes}
          deals={rr}
          onSave={ok}
          onSaveQuote={async () => ({ id: 'q1' })}
          onDeleteQuote={ok}
          onLoseQuotes={ok}
          onDeleteDeal={ok}
          onUnbookDeal={async () => ({ id: 'q8' })}
          onOpening={ok}
          onUpdateDeal={ok}
          onRate={ok}
          calendar={{ ...cal, today }}
          targets={{ software: 5, services: 20 }}
          onTarget={ok}
          accounts={accounts}
          onForecast={ok}
          onUpdateAccount={ok}
          onAssignAccount={async () => ({ accountId: 'acc-1' })}
        />
      </Shell>
    );
  }
  if (view === 'home-retro' || view === 'home-crossed') {
    // home-crossed: the same deals against a lower quota, so the month is
    // past its retro accelerator and every deal has moved up with it.
    const plan = view === 'home-crossed' ? { ...RETRO, quota: 30000, accelerator_threshold: 30000 } : RETRO;
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
          onLoseQuotes={ok}
          onDeleteDeal={ok}
          onUnbookDeal={async () => ({ id: 'q8' })}
          onOpening={ok}
          onUpdateDeal={ok}
          onRate={ok}
          calendar={calendarInZone('month', 'America/New_York')}
          targets={{ software: 5, services: 20 }}
          onTarget={ok}
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
          onLoseQuotes={ok}
          onDeleteDeal={ok}
          onUnbookDeal={async () => ({ id: 'q8' })}
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
