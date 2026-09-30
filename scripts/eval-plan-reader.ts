// Runs the AI reader over evals/plan-reader/cases.ts and scores it. Costs real
// money (a few cents a case). Needs ANTHROPIC_API_KEY in .env.local.
// Run from ioi-app/:  npx tsx scripts/eval-plan-reader.ts [low|medium|high] [case-id ...]
import { existsSync } from 'node:fs';
import { readPlan, READER } from '@/lib/plan-record/reader';
import { mapRecord } from '@/lib/plan-record/map';
import type { PlanRecord } from '@/lib/plan-record/schema';
import { CASES, CORRECTION, type Check } from '../evals/plan-reader/cases';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('No ANTHROPIC_API_KEY in .env.local. Run: node scripts/set-local-keys.mjs');
  process.exit(1);
}

const effort = (['low', 'medium', 'high'].includes(process.argv[2]) ? process.argv[2] : READER.effort) as 'low' | 'medium' | 'high';
const only = new Set(process.argv.slice(3));
const PRICE = { input: 4 / 1e6, output: 20 / 1e6, cache_read: 0.2 / 1e6, cache_write: 5 / 1e6 }; // Opus 5.5

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o === null || o === undefined ? undefined : k === 'length' && Array.isArray(o) ? o.length : (o as Record<string, unknown>)[k]), obj);

function score(result: Awaited<ReturnType<typeof readPlan>>, checks: Check[]) {
  const view: Record<string, unknown> = { kind: result.ok ? result.kind : `error:${result.ok ? '' : result.error}` };
  if (result.ok && 'record' in result) {
    const m = mapRecord(result.record);
    Object.assign(view, { record: result.record, plan: m.plan, gaps: m.gaps.map((g) => g.topic), coverage: m.coverage });
  }
  const misses = checks
    .map(([path, want]) => {
      const got = get(view, path);
      const ok = typeof want === 'function' ? (want as (v: unknown) => boolean)(got) : JSON.stringify(got ?? null) === JSON.stringify(want);
      return ok ? null : `${path}: expected ${typeof want === 'function' ? '(check)' : JSON.stringify(want)}, got ${JSON.stringify(got)?.slice(0, 160)}`;
    })
    .filter(Boolean) as string[];
  return { view, misses };
}

type Row = { id: string; checks: number; misses: string[]; ms: number; cost: number };
const rows: Row[] = [];
const records = new Map<string, PlanRecord>();

async function run(id: string, text: string, checks: Check[], current?: PlanRecord) {
  const r = await readPlan(text, { current, effort });
  const { misses } = score(r, checks);
  if (r.ok && 'record' in r) records.set(id, r.record);
  const u = r.ok ? r.usage : { input: 0, output: 0, cache_read: 0, cache_write: 0 };
  const cost = u.input * PRICE.input + u.output * PRICE.output + u.cache_read * PRICE.cache_read + u.cache_write * PRICE.cache_write;
  rows.push({ id, checks: checks.length, misses, ms: r.ok ? r.ms : 0, cost });
  console.log(`${misses.length ? 'MISS' : 'pass'}  ${id}  (${r.ok ? `${r.ms}ms, ${u.output} out, cache ${u.cache_read}` : r.error})`);
  for (const m of misses) console.log(`        ${m}`);
}

const todo = CASES.filter((c) => only.size === 0 || only.has(c.id));
// A few at a time: fast, and gentle on rate limits.
for (let i = 0; i < todo.length; i += 4) {
  await Promise.all(todo.slice(i, i + 4).map((c) => run(c.id, c.text, c.checks, c.current)));
}
if (only.size === 0 || only.has('correction')) {
  const base = records.get(CORRECTION.from);
  if (base) await run('correction', CORRECTION.text, CORRECTION.checks, base);
}

const total = rows.reduce((n, r) => n + r.checks, 0);
const missed = rows.reduce((n, r) => n + r.misses.length, 0);
const times = rows.map((r) => r.ms).filter(Boolean).sort((a, b) => a - b);
const pct = (p: number) => times[Math.min(times.length - 1, Math.floor((times.length * p) / 100))] ?? 0;
console.log(
  `\n${READER.model} effort=${effort}: ${rows.filter((r) => !r.misses.length).length}/${rows.length} cases clean, ` +
    `${total - missed}/${total} checks (${((100 * (total - missed)) / Math.max(1, total)).toFixed(1)}%). ` +
    `Latency p50 ${(pct(50) / 1000).toFixed(1)}s, p90 ${(pct(90) / 1000).toFixed(1)}s. ` +
    `Cost $${rows.reduce((n, r) => n + r.cost, 0).toFixed(3)} total, $${(rows.reduce((n, r) => n + r.cost, 0) / Math.max(1, rows.length)).toFixed(4)} a read.`,
);
