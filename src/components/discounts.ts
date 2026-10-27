import { paysHardware, type CompPlan } from '@/lib/calc';
import type { DealRow } from '@/lib/queries';

/** The lines a deal's discounts fall on. */
export type Line = 'software' | 'services' | 'hardware';

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

/** What a booked deal listed at and what its discount took off, per line,
 *  in the same dollars the plan counts: a year of subscription, one-time
 *  products and services (hardware too, unless it has its own rate). */
export function offByLine(plan: CompPlan, d: DealRow): Record<Line, { list: number; off: number }> {
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
