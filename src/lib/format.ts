import type { CompPlan } from '@/lib/calc';

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = (n: number) => usd0.format(n);
export const fmtD = (n: number) => usd2.format(n);
export const fmtP = (n: number) => `${n.toFixed(1)}%`;
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Quota credit in the plan's basis: "6 units" or "$87,330". */
export const fmtCredit = (plan: CompPlan, n: number) =>
  plan.quota_basis === 'units' ? `${Math.round(n)} unit${Math.round(n) === 1 ? '' : 's'}` : fmt(n);

/** "8.5%" or "2 months of MRR". */
export const fmtRate = (plan: CompPlan, rate: number) =>
  plan.commission_style === 'percent' ? fmtP(rate) : `${rate} month${rate === 1 ? '' : 's'} of MRR`;

export const periodNoun = (plan: CompPlan) => (plan.period === 'quarter' ? 'quarter' : 'month');
