// Pipeline health (lib/health.ts), close dates (withCloseDate) and the ARR or
// MRR display (lib/format.ts), on invented numbers.
// Run: npx tsx scripts/test-health.ts
import { periodToDateFrom, type CompPlan, type DealInput, type Quote } from '@/lib/calc';
import { closeUnits, withCloseDate } from '@/lib/closeout';
import { ageBuckets, coverage, unitHealth, winRate } from '@/lib/health';
import { fmtCredit, fmtRev, revUnit, revWord, toRev } from '@/lib/format';
import { nextPeriodStart } from '@/lib/rollover';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}

const plan = {
  role_name: 'Rep', period: 'month', quota_basis: 'arr', quota: 60000, commission_style: 'percent', base_rate: 8,
  accelerator_style: 'retro_bump', accelerator_threshold: 60000, accelerator_rate: 25, one_time_weight: 33.3,
  quarterly_kicker: null, industry: null, company_size_band: null,
} as unknown as CompPlan;
const mrrPlan = { ...plan, display_unit: 'mrr' } as CompPlan;
const unitsPlan = { ...plan, quota_basis: 'units', quota: 10, display_unit: 'mrr' } as CompPlan;
const ptd = periodToDateFrom([]);
const mrr = (sub: number): DealInput => ({ oneTime: 0, subscription: sub, subMode: 'mrr', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 });
const TODAY = '2026-11-14';
const NEXT = nextPeriodStart('month', '2026-11-01');
const q = (id: string, x: Partial<Quote> = {}): Quote => ({ id, name: id, deal: mrr(1000), createdAt: '2026-11-10T12:00:00Z', updatedAt: '2026-11-12T12:00:00Z', ...x });

// ARR or MRR on screen
check('ARR reads bare', fmtCredit(plan, 60000) === '$60,000');
check('MRR says so', fmtCredit(mrrPlan, 60000) === '$5,000 MRR', fmtCredit(mrrPlan, 60000));
check('fmtRev turns ARR into MRR', fmtRev(mrrPlan, 59220) === '$4,935' && toRev(mrrPlan, 12000) === 1000);
check('a units plan never reads MRR', revUnit(unitsPlan) === 'arr' && fmtCredit(unitsPlan, 3) === '3 units');
check('the word follows the unit', revWord(plan) === 'ARR' && revWord(mrrPlan) === 'MRR');

// Close dates
check('next period after November is December', NEXT === '2026-12-01');
check('a date in this period keeps the call', withCloseDate(q('a', { call: 'commit', forecast: 'commit', closeDate: '2026-11-20' }), NEXT).forecast === 'commit');
check('a date past it counts next period', withCloseDate(q('a', { call: 'commit', forecast: 'commit', closeDate: '2026-12-03' }), NEXT).forecast === 'next');
check('the call is kept for when the date comes back', withCloseDate(q('a', { call: 'commit', forecast: 'next', closeDate: '2026-11-25' }), NEXT).forecast === 'commit');
check('no date, the call stands', withCloseDate(q('a', { call: 'stretch', closeDate: null }), NEXT).forecast === 'stretch');
check('a quote from before calls existed keeps its forecast', withCloseDate(q('a', { forecast: 'stretch' }), NEXT).forecast === 'stretch');

const acct = [{ id: 'g', name: 'Group', oneDecision: true }];
const g = closeUnits([q('g1', { accountId: 'g', closeDate: '2026-11-20', closePushes: 1 }), q('g2', { accountId: 'g', closeDate: '2026-11-28', closePushes: 3 })], acct)[0];
check('an account closes on its latest date', g.closeDate === '2026-11-28');
check('and was pushed as often as its most pushed deal', g.pushes === 3);

// Health flags
const units = unitHealth(
  plan,
  ptd,
  [
    q('fresh', { closeDate: '2026-11-25' }),
    q('past', { closeDate: '2026-11-10' }),
    q('slipping', { closeDate: '2026-11-30', closePushes: 2 }),
    q('quiet', { closeDate: '2026-11-30', updatedAt: '2026-10-20T12:00:00Z' }),
    q('undated', { createdAt: '2026-10-25T12:00:00Z' }),
    q('old', { createdAt: '2026-08-20T12:00:00Z', closeDate: '2026-11-30' }),
  ],
  [],
  TODAY,
);
const flags = (id: string) => units.find((u) => u.unit.quotes[0].id === id)!.flags.join(',');
check('a fresh dated quote has nothing to flag', flags('fresh') === '');
check('a passed close date is flagged', flags('past') === 'past-date');
check('two pushes are a pattern', flags('slipping') === 'pushed');
check('three weeks without a touch is quiet', flags('quiet') === 'quiet', flags('quiet'));
check('two weeks open without a date is flagged', flags('undated') === 'no-date', flags('undated'));
check('sixty days open is old', flags('old') === 'aging', flags('old'));
check('ages are days since the first save', units.find((u) => u.unit.quotes[0].id === 'old')!.age === 86);
check('each decision carries its credit and pay', units[0].credit === 12000 && units[0].pay > 0 && units[0].arr === 12000);

// Coverage and age
check('coverage is open over what is left', coverage(36000, 12000) === 3);
check('no coverage once nothing is left', coverage(36000, 0) === null);
const b = ageBuckets(units);
check('ages land in four buckets', b.map((x) => x.count).join() === '5,0,1,0', b.map((x) => x.count).join());
check('each bucket carries its credit', b[0].credit === 60000 && b[2].credit === 12000);

// Win rate
const booked = [
  { created_at: '2026-11-01T12:00:00Z' },
  { created_at: '2026-10-01T12:00:00Z' },
  { created_at: '2026-10-05T12:00:00Z', kind: 'upsell' as const },
  { created_at: '2026-06-01T12:00:00Z' },
];
const lost = [
  { closedAt: '2026-11-02T12:00:00Z', reason: 'price' },
  { closedAt: '2026-10-20T12:00:00Z', reason: 'price' },
  { closedAt: '2026-09-20T12:00:00Z', reason: 'timing' },
];
const w = winRate(booked, lost, TODAY);
check('wins skip upsells and anything older than 90 days', w.won === 2, String(w.won));
check('losses inside the window count', w.lost === 3);
check('the rate is won over decided', w.rate === 2 / 5);
check('the most common reason is named', w.topReason === 'price');
check('no rate until three are decided', winRate([booked[0]], [lost[0]], TODAY).rate === null);

console.log(`\n${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) process.exit(1);
