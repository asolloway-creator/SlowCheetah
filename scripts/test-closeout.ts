// Close-out checks (lib/closeout.ts), on invented numbers: accounts that
// decide as one count as one decision, calls build the three lines, and the
// must-close list names the decisions quota can't do without.
// Run: npx tsx scripts/test-closeout.ts
import { periodToDateFrom, type CompPlan, type DealInput, type Quote } from '@/lib/calc';
import { closeLine, closeUnits, mustClose } from '@/lib/closeout';
import { changedLines, longDay, offerLine, suggestOffer } from '@/lib/offers';

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
const quotes = [q('a', 1000, null, 'commit', 1), q('g1', 500, 'g', 'commit', 2), q('g2', 500, 'g', 'stretch', 3), q('g3', 500, 'g', 'commit', 4), q('b', 250, null, null, 5)];
const accounts = [{ id: 'g', name: 'Group', oneDecision: true }];
const units = closeUnits(quotes, accounts);

check('an account that decides as one is one decision', units.length === 3 && units.some((u) => u.label === 'Group' && u.quotes.length === 3));
const g = units.find((u) => u.label === 'Group')!;
check('mixed calls take the most cautious one', g.forecast === 'stretch' && g.mixed);

const commit = closeLine(plan, ptd, null, units, 'commit');
const best = closeLine(plan, ptd, null, units, 'stretch');
const all = closeLine(plan, ptd, null, units, 'all');
check('commit counts only commits (A)', Math.round(commit.credit) === 42000, String(commit.credit));
check('with stretch adds the stretch group', Math.round(best.credit) === 60000 && best.hits, String(best.credit));
check('everything adds what has no call', Math.round(all.credit) === 63000, String(all.credit));
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

// Sign-by offers: the cheapest line inside the rep's targets, never one
// that costs quota credit when the period is near the line.
const near = mrr(1000, 0); // 12,000 ARR, one-time 1,000 at 50% off
const nearOthers = [mrr(1500), mrr(250)]; // with booked 30,000: 30,000 + 12,000 + 18,000 + 3,000 = 63,000, 5% over
const o1 = suggestOffer(plan, ptd, null, near, nearOthers, { services: 75, software: 10 });
check('offer spends one-time first, up to the target', o1.kind === 'offer' && o1.offer.line === 'services' && o1.offer.toPct === 75 && o1.offer.creditChange === 0, JSON.stringify(o1));
const pastOt = { ...near, oneTimeDiscountPct: 80 };
const o2 = suggestOffer(plan, ptd, null, pastOt, nearOthers, { services: 75, software: 10 });
check('near the line, no offer that costs quota credit', o2.kind === 'none' && o2.reason === 'breaks-quota', JSON.stringify(o2));
const o3 = suggestOffer(plan, ptd, null, { ...pastOt, subscriptionDiscountPct: 20 }, nearOthers, { services: 75, software: 10 });
check('past every target, no offer', o3.kind === 'none' && o3.reason === 'past-targets');
const roomy = suggestOffer(plan, ptd, null, pastOt, [mrr(1500), mrr(1500)], { services: 75, software: 10 });
check('with room to spare, a subscription offer inside the target', roomy.kind === 'offer' && roomy.offer.line === 'software' && roomy.offer.toPct === 10, JSON.stringify(roomy));
const capped = suggestOffer({ ...plan, limits: { services: 60 } }, ptd, null, near, nearOthers, { services: 75, software: 10 });
check('the company limit caps an offer below the target', capped.kind === 'offer' && capped.offer.line === 'services' && capped.offer.toPct === 60, JSON.stringify(capped));
const banned = suggestOffer({ ...plan, limits: { services: 0, software: 0 } }, ptd, null, near, nearOthers, { services: 75, software: 10 });
check('no discount allowed on any line: no offer', banned.kind === 'none' && banned.reason === 'past-targets');
// The offer as one sentence: only what changed, in dollars to the buyer.
const hw = (pct: number): DealInput => ({ ...mrr(1000), hardware: 2000, hardwareDiscountPct: pct });
const eq = changedLines(hw(70), hw(80));
check('the offer names only the line that changed', eq.length === 1 && eq[0].line === 'hardware' && Math.round(eq[0].saves) === 200, JSON.stringify(eq));
check('the offer line is one sentence with the dollars and the deadline', offerLine(eq, '2026-10-31') === '$200 off the equipment if the agreement is signed by end of day Saturday, Oct 31.', offerLine(eq, '2026-10-31'));
const two = changedLines({ ...hw(70), oneTimeDiscountPct: 50 }, { ...hw(80), oneTimeDiscountPct: 60 });
check('two lines read as one sentence', offerLine(two, '2026-10-31').startsWith('$100 off the services and $200 off the equipment if'), offerLine(two, '2026-10-31'));
check('the offer line never mentions commission, quota or targets', !/commission|quota|target|limit|accelerator/i.test(offerLine(two, '2026-10-31')));
check('no change, no lines', changedLines(hw(70), hw(70)).length === 0);
check('a long day reads as a weekday and date', longDay('2026-10-31') === 'Saturday, Oct 31');
check('an offer is worth less to the rep than the deal', o1.kind === 'offer' && o1.offer.cost < o1.worth);

console.log(`\n${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) process.exit(1);
