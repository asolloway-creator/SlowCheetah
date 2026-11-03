// What needs the rep first (lib/needs.ts), on invented numbers.
// Run: npx tsx scripts/test-needs.ts
import { periodToDateFrom, type CompPlan, type DealInput, type Quote } from '@/lib/calc';
import { withCloseDate } from '@/lib/closeout';
import { needsYou } from '@/lib/needs';

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
const booked = (arr: number) => ({ quota_credit: arr, arr, commission_base: arr * 0.08, commission_earned: arr * 0.08, hardware_commission: 0, saas_commission: arr * 0.08, created_at: '2026-11-03T12:00:00Z' });
const mrr = (sub: number): DealInput => ({ oneTime: 0, subscription: sub, subMode: 'mrr', units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 });
const TODAY = '2026-11-14';
const NEXT = '2026-12-01';
const q = (id: string, x: Partial<Quote> = {}): Quote => withCloseDate({ id, name: id, deal: mrr(1000), createdAt: '2026-11-10T12:00:00Z', updatedAt: '2026-11-12T12:00:00Z', call: 'commit', forecast: 'commit', closeDate: '2026-11-25', ...x }, NEXT);
const ptd = periodToDateFrom([booked(40000)] as never);
const run = (quotes: Quote[], left = 17) => needsYou(plan, ptd, null, quotes, [], TODAY, left);

check('healthy decisions need nothing', run([q('a'), q('b')]).length === 0);
check('a passed close date needs a look', run([q('a', { closeDate: '2026-11-10' })])[0]?.kind === 'past-date');
check('two pushes read as sliding', run([q('a', { closePushes: 2 })])[0]?.kind === 'pushed');
check('a quiet one is flagged', run([q('a', { updatedAt: '2026-10-20T12:00:00Z' })])[0]?.kind === 'quiet');
check('a deal pushed to next month is not this month’s to chase', run([q('a', { closeDate: '2026-12-05', closePushes: 3, updatedAt: '2026-09-01T12:00:00Z' })]).length === 0);

// 40,000 booked of 60,000; 12,000 each. Two of them reach quota, so each is a must when only two are open.
const two = run([q('a'), q('b')].map((x) => ({ ...x, deal: mrr(840) })), 10);
check('a decision the month cannot lose comes first near the end', two.length > 0 && two.every((n) => n.kind === 'must'), JSON.stringify(two.map((n) => n.kind)));
check('early in the month there is no must-close', run([q('a'), q('b')].map((x) => ({ ...x, deal: mrr(840) })), 25).length === 0);
check('past-date outranks pushed', run([q('a', { closePushes: 2, label: 'x' } as never), q('b', { closeDate: '2026-11-10' })])[0].label === 'b');
check('no call in the last week is a need', run([q('a', { call: null, forecast: null })], 5)[0]?.kind === 'uncalled');
check('no call early in the month is not', run([q('a', { call: null, forecast: null })], 20).length === 0);
const m = run([q('a', { closeDate: '2026-11-10' })].map((x) => ({ ...x, deal: mrr(840) })).concat([q('b')].map((x) => ({ ...x, deal: mrr(840) }))), 10);
check('a must-close with a flag explains both', m[0].kind === 'must' && /quota/.test(m[0].why) && /close date/i.test(m[0].why), m[0]?.why);
check('money breaks ties', run([q('s', { closeDate: '2026-11-10', deal: mrr(100) }), q('big', { closeDate: '2026-11-10', deal: mrr(5000) })])[0].label === 'big');

console.log(`\n${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) process.exit(1);
