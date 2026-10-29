import { paysHardware, periodSummary, periodToDateFrom, type CompPlan, type PeriodToDate } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';

/** The lines a deal's discounts fall on. */
export type Line = 'software' | 'services' | 'hardware';

/** The rep's own discount ceilings, per line, in percent: the most they mean
 *  to give. Their rule, not the company's approval limits. */
export type Targets = Partial<Record<Line, number>>;

export const LINES: Line[] = ['software', 'services', 'hardware'];

/** Targets as stored (comp_plans.targets), cleaned. Anything odd is dropped. */
export function parseTargets(v: unknown): Targets {
  const out: Targets = {};
  if (!v || typeof v !== 'object') return out;
  for (const line of LINES) {
    const n = (v as Record<string, unknown>)[line];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100) out[line] = Math.round(n * 10) / 10;
  }
  return out;
}

/**
 * What each line's discount cost, from the deal's stored total
 * (money_left_on_table). On a percent plan every line pays the same rate on
 * its commissionable dollars, so the total splits by the commissionable
 * dollars each discount took off: a year of subscription, one-time at the
 * plan's weight. Hardware on its own flat rate is its own slice, worked out
 * exactly. A plan paid in months of MRR pays on the subscription only.
 */
export function lostByLine(plan: CompPlan, d: DealRow): Record<Line, number> {
  const split = paysHardware(plan);
  const hwRate = split ? (plan.hardware_rate as number) / 100 : 0;
  const hwOff = (d.hardware_amount ?? 0) * ((d.hardware_discount_pct ?? 0) / 100);
  const hardware = split ? Math.min(d.money_left_on_table, hwOff * hwRate) : 0;
  const rest = Math.max(0, d.money_left_on_table - hardware);
  if (plan.commission_style !== 'percent') return { software: rest, services: 0, hardware };
  const off = offByLine(plan, d);
  const subOff = off.software.off;
  const otOff = off.services.off * (plan.one_time_weight / 100);
  const total = subOff + otOff;
  if (!(total > 0)) return { software: rest, services: 0, hardware };
  // Cents that add back up to the deal's own total.
  const software = Math.round(((rest * subOff) / total) * 100) / 100;
  return { software, services: Math.max(0, Math.round((rest - software) * 100) / 100), hardware };
}

/**
 * How much more every deal booked this period pays than it was saved at: on
 * a retro plan past its accelerator, the whole period moves to the higher
 * rate (8.26% deals now pay 10.26%), so what each earned and what each
 * discount cost both grow by the same factor. 1 otherwise: a rate-switch
 * deal is saved at the rate it actually earns.
 */
export function rateLift(plan: CompPlan, ptd: PeriodToDate): number {
  if (plan.accelerator_style !== 'retro_bump') return 1;
  const s = periodSummary(plan, ptd);
  return s.step ? 1 + s.step.rate / 100 : 1;
}

/** How far above its base rate a deal was saved: 1 for a deal saved before
 *  its period crossed a retro accelerator, the bump for one saved after. */
function savedLift(d: DealRow): number {
  const hw = d.hardware_commission ?? 0;
  return d.commission_base > 0 ? (d.commission_earned - hw) / d.commission_base : 1;
}

/**
 * A booked deal's commission as its period pays now. On a retro plan every
 * deal in the period is at its base commission times `lift`, whenever it was
 * saved (commission_base is always the pre-accelerator figure). Elsewhere,
 * and with `lift` null (an earlier period, as it was), what was saved.
 * Hardware on its own flat rate never moves.
 */
export function earnedNow(plan: CompPlan, d: DealRow, lift: number | null): number {
  if (lift === null || plan.accelerator_style !== 'retro_bump') return d.commission_earned;
  return d.commission_base * lift + (d.hardware_commission ?? 0);
}

/** What each line's discount costs as its period pays now (see earnedNow). */
export function lostNow(plan: CompPlan, d: DealRow, lift: number | null): Record<Line, number> {
  const l = lostByLine(plan, d);
  if (lift === null || plan.accelerator_style !== 'retro_bump') return l;
  const f = lift / savedLift(d);
  return { software: l.software * f, services: l.services * f, hardware: l.hardware };
}

/** What a booked deal listed at and what its discount took off, per line,
 *  in the same dollars the plan counts: a year of subscription, one-time
 *  products and services (hardware too, unless it has its own rate). */
export function offByLine(plan: CompPlan, d: DealRow): Record<Line, { list: number; off: number }> {
  // Booked ARR entered without a quote has no discount to measure; counting
  // it at 0% off would pull every average down.
  if (d.kind === 'upsell') return { software: { list: 0, off: 0 }, services: { list: 0, off: 0 }, hardware: { list: 0, off: 0 } };
  const split = paysHardware(plan);
  const subList = d.subscription_mode === 'acv' ? d.subscription_amount : d.subscription_amount * 12;
  const hw = d.hardware_amount ?? 0;
  const hwOff = hw * ((d.hardware_discount_pct ?? 0) / 100);
  return {
    software: { list: subList, off: subList * (d.subscription_discount_pct / 100) },
    services: {
      list: d.one_time_amount + (split ? 0 : hw),
      off: d.one_time_amount * (d.one_time_discount_pct / 100) + (split ? 0 : hwOff),
    },
    hardware: split ? { list: hw, off: hwOff } : { list: 0, off: 0 },
  };
}

/** What a dollar off each line costs the rep, by the plan's own rules, for
 *  when there's nothing booked yet to measure it from. */
export function costPerDollar(plan: CompPlan, line: Line): number {
  if (line === 'hardware') return (plan.hardware_rate ?? 0) / 100;
  if (plan.commission_style !== 'percent') return 0;
  return (plan.base_rate / 100) * (line === 'services' ? plan.one_time_weight / 100 : 1);
}

export type PeriodTotals = {
  count: number;
  earned: number;
  lost: number;
  /** Per line with anything listed: average discount by dollars, and cost. */
  lines: Partial<Record<Line, { avg: number; cost: number; list: number; off: number }>>;
};

/**
 * One period's deals added up: what they earned and what their discounts
 * left on the table, at the rate that period paid. `lift` is that period's
 * (see rateLift); for a closed period, pass null to work it out from its own
 * deals, which is where it finished.
 */
export function periodTotals(plan: CompPlan, rows: DealRow[], lift: number | null): PeriodTotals {
  const l = lift ?? rateLift(plan, periodToDateFrom(rows));
  const totals: PeriodTotals = { count: rows.length, earned: 0, lost: 0, lines: {} };
  for (const line of LINES) {
    let list = 0;
    let off = 0;
    let cost = 0;
    for (const d of rows) {
      const o = offByLine(plan, d)[line];
      list += o.list;
      off += o.off;
      cost += lostNow(plan, d, l)[line];
    }
    if (list > 0) totals.lines[line] = { avg: (off / list) * 100, cost, list, off };
  }
  for (const d of rows) {
    totals.earned += earnedNow(plan, d, l);
  }
  totals.lost = Object.values(totals.lines).reduce((n, x) => n + (x?.cost ?? 0), 0);
  return totals;
}
