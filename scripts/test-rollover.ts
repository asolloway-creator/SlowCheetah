// What carries across a month line (lib/rollover.ts), on invented numbers: a
// day is read in the rep's own zone, the quarter splits into months with the
// pre-IOI part left over, and the period just ended is found and totaled.
// Run: npx tsx scripts/test-rollover.ts
import { dayInZone, lastPeriodCredit, previousPeriod, quarterView } from '@/lib/rollover';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}

const NY = 'America/New_York';
// 9pm Eastern on Oct 31 is already Nov 1 in UTC.
check('a late-night deal on the last day is still that day', dayInZone('2026-11-01T01:30:00Z', NY) === '2026-10-31');
check('the same instant is next month in UTC', dayInZone('2026-11-01T01:30:00Z', 'UTC') === '2026-11-01');
check('a bad date gives nothing', dayInZone('not a date', NY) === '');

check('the month before November is October', previousPeriod('month', '2026-11-01').key === '2026-10' && previousPeriod('month', '2026-11-01').start === '2026-10-01');
check('the month before January is last December', previousPeriod('month', '2027-01-01').key === '2026-12' && previousPeriod('month', '2027-01-01').start === '2026-12-01');
check('the quarter before Q1 is last Q4', previousPeriod('quarter', '2027-01-01').key === '2026-Q4' && previousPeriod('quarter', '2027-01-01').start === '2026-10-01');

const deals = [
  { created_at: '2026-10-05T16:00:00Z', arr: 20000, quota_credit: 20000 },
  { created_at: '2026-11-01T01:30:00Z', arr: 5000, quota_credit: 5000 }, // Oct 31 in New York
  { created_at: '2026-11-02T15:00:00Z', arr: 7000, quota_credit: 7000 },
  { created_at: '2026-09-20T15:00:00Z', arr: 9999, quota_credit: 9999 }, // last quarter
];
const qv = quarterView(deals, 25000 + 7000 + 4000, '2026-11-03', NY);
check('the quarter is named', qv.label === 'Q4 2026');
check('three months, October to December', qv.months.map((m) => m.label).join() === 'October,November,December');
check('October counts the late-night deal', qv.months[0].arr === 25000, String(qv.months[0].arr));
check('November has its own', qv.months[1].arr === 7000);
check('December is ahead, October past, November now', qv.months.map((m) => m.state).join() === 'past,now,ahead');
check('what the deals do not explain is from before IOI', qv.before === 4000, String(qv.before));
check('nothing left over when deals explain it', quarterView(deals, 32000, '2026-11-03', NY).before === 0);
check('never negative', quarterView(deals, 100, '2026-11-03', NY).before === 0);
check('the first month of a quarter reads the same way', quarterView([], 0, '2027-01-04', NY).months[0].label === 'January');

check('last month is its deals, in the rep’s own zone', lastPeriodCredit('month', '2026-11-01', deals, null, NY) === 25000);
check('the same deals in UTC lose the late-night one', lastPeriodCredit('month', '2026-11-01', deals, null, 'UTC') === 20000);
check('a saved starting point for last month is added', lastPeriodCredit('month', '2026-11-01', deals, { periodKey: '2026-10', credit: 3000 }, NY) === 28000);
check('one for another month is not', lastPeriodCredit('month', '2026-11-01', deals, { periodKey: '2026-09', credit: 3000 }, NY) === 25000);

console.log(`\n${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) process.exit(1);
