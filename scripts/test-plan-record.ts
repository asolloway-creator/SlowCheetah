// Checks the plan record's mapping, wording and questions without calling Claude.
// Run from ioi-app/:  npx tsx scripts/test-plan-record.ts
import assert from 'node:assert/strict';
import { calc, DEMO_PLAN, PRESETS, type CompPlan } from '@/lib/calc';
import { cleanTitle, NO_CHOICES, PlanRecord, recordFromWire, type WireRead } from '@/lib/plan-record/schema';
import { mapRecord, recordFromPlan } from '@/lib/plan-record/map';
import { applyAnswer, assumedText, limitCopy, question, readback, workedExample } from '@/lib/plan-record/copy';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n`, e);
    process.exitCode = 1;
  }
};

const EM_DASH = /—/;
const allText = (r: PlanRecord) => {
  const m = mapRecord(r);
  return readback(r, m).flatMap((g) => [g.title, ...g.lines.map((l) => l.text)]);
};

/** A wire read with everything empty, to override per test. */
const wire = (over: Partial<WireRead>): WireRead => ({
  input_kind: 'plan',
  role_level: 'ae',
  role_title: '',
  quota: { period: 'quarter', measure: 'new_arr', amount: 150000, source: 'stated' },
  pay_rules: [{ applies_to: 'all', method: 'percent_of_value', value_basis: 'first_year_value', rate: 10, source: 'stated' }],
  one_time_counts_pct: 0,
  one_time_source: 'stated',
  accelerators: [],
  floors: [],
  discount_rules: [],
  bonuses: [],
  caps: [],
  clawbacks: [],
  draws: [],
  paid_when: 'unknown',
  other_features: [],
  ...over,
});

const strip = (p: CompPlan) => ({ ...p, role_name: '', industry: null, company_size_band: null });

// ── Round trips: every plan the engine already knows survives record -> plan ──
for (const p of [...PRESETS.map((x) => x.plan), DEMO_PLAN]) {
  test(`round trip ${p.role_name} ${p.accelerator_style}`, () => {
    const r = recordFromPlan(p);
    PlanRecord.parse(r);
    const m = mapRecord(r);
    assert.deepEqual(m.gaps, []);
    assert.deepEqual(m.limits, []);
    assert.ok(m.plan);
    assert.deepEqual(strip(m.plan), strip(p));
    for (const t of allText(r)) assert.ok(!EM_DASH.test(t), `em dash in: ${t}`);
  });
}

// ── Conversions ────────────────────────────────────────────────────────────
test('annual quota is a limit until the person chooses quarterly', () => {
  const r = recordFromWire(wire({ quota: { period: 'year', measure: 'new_arr', amount: 800000, source: 'stated' } }));
  const blocked = mapRecord(r);
  assert.equal(blocked.plan, null);
  assert.deepEqual(blocked.limits, ['period_year']);
  assert.ok(limitCopy('period_year', r).body.includes('$200,000'));
  const run = mapRecord(r, { ...NO_CHOICES, as_quarterly: true });
  assert.equal(run.plan?.period, 'quarter');
  assert.equal(run.plan?.quota, 200000);
  assert.equal(run.coverage.find((c) => c.area === 'quota')?.status, 'approximated');
});

test('an MRR quota runs as ARR, exactly', () => {
  const r = recordFromWire(wire({ quota: { period: 'month', measure: 'mrr', amount: 5000, source: 'stated' } }));
  const m = mapRecord(r);
  assert.equal(m.plan?.quota_basis, 'arr');
  assert.equal(m.plan?.quota, 60000);
  assert.equal(m.coverage.find((c) => c.area === 'quota')?.status, 'calculated');
});

test('a deal-count quota runs as units and never scales by 12', () => {
  const r = recordFromWire(wire({ quota: { period: 'year', measure: 'deals', amount: 40, source: 'stated' } }));
  const m = mapRecord(r, { ...NO_CHOICES, as_quarterly: true });
  assert.equal(m.plan?.quota_basis, 'units');
  assert.equal(m.plan?.quota, 10);
});

test('repaying every deal at a higher rate equals a whole-period bump', () => {
  const r = recordFromWire(
    wire({
      accelerators: [{ kind: 'retroactive_rate', starts_at_pct: 100, starts_at_amount: -1, rate: 15, source: 'stated' }],
    }),
  );
  const m = mapRecord(r);
  assert.equal(m.plan?.accelerator_style, 'retro_bump');
  assert.equal(m.plan?.accelerator_rate, 50);
  assert.equal(m.plan?.accelerator_threshold, 150000);
});

test('a separate one-time rate becomes the one-time weight', () => {
  const r = recordFromWire(
    wire({
      pay_rules: [
        { applies_to: 'recurring', method: 'percent_of_value', value_basis: 'arr', rate: 10, source: 'stated' },
        { applies_to: 'one_time', method: 'percent_of_value', value_basis: 'not_applicable', rate: 5, source: 'stated' },
      ],
      one_time_counts_pct: -1,
    }),
  );
  const m = mapRecord(r);
  assert.equal(m.plan?.base_rate, 10);
  assert.equal(m.plan?.one_time_weight, 50);
  assert.ok(allText(r).includes('One-time charges pay 5%.'));
});

test('a marginal tier runs, flagged as close rather than exact', () => {
  const r = recordFromWire(
    wire({ accelerators: [{ kind: 'marginal_tier', starts_at_pct: 100, starts_at_amount: -1, rate: 15, source: 'stated' }] }),
  );
  const m = mapRecord(r);
  assert.equal(m.plan?.accelerator_style, 'rate_switch');
  assert.equal(m.coverage.find((c) => c.area === 'accelerators')?.status, 'approximated');
});

test('a second accelerator step is kept but not calculated', () => {
  const r = recordFromWire(
    wire({
      accelerators: [
        { kind: 'forward_rate', starts_at_pct: 150, starts_at_amount: -1, rate: 20, source: 'stated' },
        { kind: 'forward_rate', starts_at_pct: 100, starts_at_amount: -1, rate: 15, source: 'stated' },
      ],
    }),
  );
  const m = mapRecord(r);
  assert.equal(m.plan?.accelerator_threshold, 150000, 'the lower step runs, whatever order it was described in');
  assert.equal(m.plan?.accelerator_rate, 15);
  assert.equal(m.coverage.find((c) => c.area === 'accelerators' && c.index === 0)?.status, 'not_yet');
});

// ── Gaps, answers and assumptions ────────────────────────────────────────────
test('missing essentials become questions, and answers fill them', () => {
  let r = recordFromWire(
    wire({
      quota: { period: 'unknown', measure: 'new_arr', amount: -1, source: 'stated' },
      accelerators: [{ kind: 'unknown', starts_at_pct: 100, starts_at_amount: -1, rate: 15, source: 'stated' }],
    }),
  );
  let m = mapRecord(r);
  assert.deepEqual(
    m.gaps.map((g) => g.topic),
    ['quota_amount', 'quota_period', 'accelerator_kind'],
  );
  assert.equal(question(r, 'quota_amount', 0).kind, 'number');
  r = applyAnswer(r, 'quota_amount', 0, 120000, 'answered');
  r = applyAnswer(r, 'quota_period', 0, 'quarter', 'answered');
  r = applyAnswer(r, 'accelerator_kind', 0, 'forward_rate', 'answered');
  m = mapRecord(r);
  assert.deepEqual(m.gaps, []);
  assert.equal(m.plan?.quota, 120000);
  assert.equal(r.quota.source, 'answered');
  PlanRecord.parse(r);
});

test('one-time charges default to 0% and say so', () => {
  const r = recordFromWire(wire({ one_time_counts_pct: -1 }));
  const m = mapRecord(r);
  assert.equal(m.plan?.one_time_weight, 0);
  const a = m.assumed.find((x) => x.topic === 'one_time_weight');
  assert.ok(a);
  assert.match(assumedText(r, a, m), /0%/);
});

test('a single-tier quarterly bonus runs against the quota by default', () => {
  const r = recordFromWire(
    wire({
      bonuses: [
        {
          kind: 'period_kicker', period: 'quarter', measure: 'unknown', target_amount: -1, spiff_for: 'not_applicable',
          tiers: [{ at_pct: 110, pays_pct: 10, pays_amount: -1 }], source: 'stated',
        },
      ],
    }),
  );
  const m = mapRecord(r);
  assert.deepEqual(m.plan?.quarterly_kicker, { target: 150000, tiers: [{ attainmentPct: 110, kickerPct: 10 }] });
  assert.ok(allText(r).includes('A quarterly bonus: hit 110% and the quarter’s commission goes up 10%.'), allText(r).join('\n'));
  assert.ok(m.assumed.some((x) => x.topic === 'kicker_target'));
});

test('caps, clawbacks and draws are kept with the right status', () => {
  const r = recordFromWire(
    wire({
      caps: [{ kind: 'total_commission', pct_of_target: 200, amount: -1, source: 'stated' }],
      clawbacks: [{ within_months: 6, share_pct: 100, source: 'stated' }],
      draws: [{ kind: 'recoverable', monthly_amount: 3000, months: 3, source: 'stated' }],
      paid_when: 'collection',
    }),
  );
  const m = mapRecord(r);
  assert.ok(m.plan, 'limits and timing never block the numbers');
  assert.equal(m.coverage.find((c) => c.area === 'caps')?.status, 'not_yet');
  assert.equal(m.coverage.find((c) => c.area === 'clawbacks')?.status, 'recorded');
  const text = allText(r);
  assert.ok(text.includes('Commission stops at 200% of target.'), text.join('\n'));
  assert.ok(text.includes('If a customer cancels within 6 months, the commission comes back.'), text.join('\n'));
  assert.ok(text.includes('A recoverable draw of $3,000 a month for 3 months.'), text.join('\n'));
});

test('flat per-deal pay is described but blocks the numbers', () => {
  const r = recordFromWire(
    wire({ pay_rules: [{ applies_to: 'all', method: 'flat_per_deal', value_basis: 'not_applicable', rate: 500, source: 'stated' }] }),
  );
  const m = mapRecord(r);
  assert.equal(m.plan, null);
  assert.deepEqual(m.limits, ['method_flat']);
});

// ── Titles never carry a company or a name ─────────────────────────────────
test('titles', () => {
  assert.equal(cleanTitle('Senior AE'), 'Senior AE');
  assert.equal(cleanTitle('Enterprise Account Executive'), 'Enterprise Account Executive');
  assert.equal(cleanTitle('Mid-Market AE II'), 'Mid-Market AE II');
  assert.equal(cleanTitle('Acme Senior AE'), null);
  assert.equal(cleanTitle('AE at Stripe'), null);
  assert.equal(cleanTitle('Jordan'), null);
  assert.equal(cleanTitle(''), null);
});

// ── Worked example matches the engine ───────────────────────────────────────
test('worked example', () => {
  const p = PRESETS.find((x) => x.id === 'units-switch')!.plan;
  const w = workedExample(p);
  const deal = { oneTime: 0, subscription: 1000, subMode: 'mrr' as const, units: 1, oneTimeDiscountPct: 0, subscriptionDiscountPct: 0 };
  const cents = (n: number | null | undefined) => Math.round((n ?? NaN) * 100) / 100;
  assert.equal(w.before, calc(p, deal, { creditBooked: 0, commissionBooked: 0, earnedBooked: 0 }).commissionEffective);
  assert.equal(cents(w.before), 840);
  assert.equal(cents(w.after), 1140);
  assert.equal(cents(w.oneTime?.adds), 56);
  const retro = workedExample(PRESETS.find((x) => x.id === 'arr-retro')!.plan);
  assert.match(retro.deal, /\$20,000/);
  assert.match(retro.afterNote ?? '', /25%/);
});

console.log(`${passed} passed${process.exitCode ? ', some failed' : ''}`);
for (const p of [PRESETS[0].plan, DEMO_PLAN]) {
  console.log(`\n${p.role_name}:`);
  const r = recordFromPlan(p);
  for (const g of readback(r, mapRecord(r))) console.log(`  ${g.title}\n${g.lines.map((l) => `    ${l.text}`).join('\n')}`);
}
