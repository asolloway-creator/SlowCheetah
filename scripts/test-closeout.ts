// Close-out checks (lib/closeout.ts), on invented numbers: accounts that
// decide as one count as one decision, calls build the three lines, and the
// must-close list names the decisions quota can't do without.
// Run: npx tsx scripts/test-closeout.ts
import { periodToDateFrom, type CompPlan, type DealInput, type Quote } from '@/lib/calc';
import { closeLine, closeUnits, mustClose } from '@/lib/closeout';

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
const booked = (arr: number) => ({ quota_credit: arr, arr, commission_base: arr * 0.08, commission_earned: arr * 0.08, hardware_commission: 0, saas_commission: arr * 0.08, created_at: '2026-01-05T12:00:00Z' });
const ptd = periodToDateFrom([booked(20000), booked(10000)] as never);
const mrr = (sub: number, off = 0): DealInput => ({ oneTime: 1000, subscription: sub, subMode: 'mrr', units: 1, oneTimeDiscountPct: 50, subscriptionDiscountPct: off });
const q = (id: string, sub: number, accountId: string | null, forecast: Quote['forecast'], i: number): Quote => ({
  id, name: `Deal ${id}`, deal: mrr(sub), accountId, forecast, createdAt: `2026-01-20T1${i}:00:00Z`, updatedAt: '',
});

// 30,000 booked; quota 60,000. A: 12,000 ARR. Group G (one decision): 3 x 6,000 = 18,000. B: 3,000.
const quotes = [q('a', 1000, null, 'commit', 1), q('g1', 500, 'g', 'commit', 2), q('g2', 500, 'g', 'likely', 3), q('g3', 500, 'g', 'commit', 4), q('b', 250, null, 'stretch', 5)];
const accounts = [{ id: 'g', name: 'Group', oneDecision: true }];
const units = closeUnits(quotes, accounts);

check('an account that decides as one is one decision', units.length === 3 && units.some((u) => u.label === 'Group' && u.quotes.length === 3));
const g = units.find((u) => u.label === 'Group')!;
check('mixed calls take the most cautious one', g.forecast === 'likely' && g.mixed);

const commit = closeLine(plan, ptd, null, units, 'commit');
const best = closeLine(plan, ptd, null, units, 'best');
const all = closeLine(plan, ptd, null, units, 'all');
check('commit counts only commits (A)', Math.round(commit.credit) === 42000, String(commit.credit));
check('best case adds the likely group', Math.round(best.credit) === 60000 && best.hits, String(best.credit));
check('everything adds the stretch', Math.round(all.credit) === 63000, String(all.credit));
check('lines never go down', commit.credit <= best.credit && best.credit <= all.credit && commit.commission <= best.commission && best.commission <= all.commission);
check('crossing the retro accelerator lifts the whole month', Math.abs(best.commission - 60000 * 0.08 * 1.25 - 4 * 1000 * 0.5 * 0.333 * 0.08 * 1.25) < 1, String(best.commission));
check('short line knows what crossing is worth', commit.crossingWorth !== null && commit.crossingWorth > 0 && commit.gap === 18000);

const mc = mustClose(plan, ptd, null, all);
check('must-close names the group and A, not B', mc.must.map((u) => u.label).sort().join(',') === 'Deal a,Group', mc.must.map((u) => u.label).join(','));
check('cushion is what everything clears quota by', Math.round(mc.cushion) === 3000, String(mc.cushion));

const separate = closeUnits(quotes, [{ id: 'g', name: 'Group', oneDecision: false }]);
check('separate decisions stay separate', separate.length === 5);
const nextMonth = closeUnits(quotes.map((x) => (x.accountId ? { ...x, forecast: 'next' as const } : x)), accounts);
check('next month leaves every line', closeLine(plan, ptd, null, nextMonth, 'all').units.every((u) => u.label !== 'Group'));

console.log(`\n${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) process.exit(1);
