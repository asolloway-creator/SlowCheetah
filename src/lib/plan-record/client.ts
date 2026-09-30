'use client';

import { internalDevice, visitorId } from '@/lib/track';
import type { CalcChoices, PlanContext, PlanRecord } from './schema';
import type { Topic } from './map';
import type { ReaderMeta } from './reader';

/** What the reader endpoint hands back for a genuine read, signature included. */
export type SignedRead = { record: PlanRecord; meta: ReaderMeta & { served_by: string }; token: string | null };

export type ReadOutcome =
  | { kind: 'plan'; read: SignedRead }
  | { kind: 'too_vague'; read: SignedRead }
  | { kind: 'document' }
  | { kind: 'not_a_plan' }
  | { kind: 'error'; error: 'busy' | 'unavailable' | 'refused' | 'failed' | 'too_long' | 'offline' };

async function post(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return null;
  }
}

export async function readDescription(text: string, current?: PlanRecord): Promise<ReadOutcome> {
  const res = await post('/api/plan/read', {
    text,
    mode: current ? 'correct' : 'describe',
    current,
    visitorId: visitorId(),
  });
  if (!res) return { kind: 'error', error: 'offline' };
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    const e = body?.error;
    return { kind: 'error', error: e === 'busy' || e === 'unavailable' || e === 'refused' || e === 'too_long' ? e : 'failed' };
  }
  if (body.kind === 'document' || body.kind === 'not_a_plan') return { kind: body.kind };
  const read: SignedRead = { record: body.record, meta: body.meta, token: body.token ?? null };
  return body.kind === 'too_vague' ? { kind: 'too_vague', read } : { kind: 'plan', read };
}

export type Asked = { topic: Topic; how: 'answered' | 'corrected' };

/** Files a confirmed plan. Never blocks the person: a failure here only means it isn't counted. */
export async function confirmPlan(args: {
  origin: 'described' | 'form';
  record: PlanRecord;
  choices: CalcChoices;
  read: SignedRead | null;
  questions: Asked[];
}): Promise<string | null> {
  const res = await post('/api/plan/confirm', {
    ...args,
    read: args.read && args.read.token ? args.read : null,
    questions: args.questions.slice(0, 20),
    visitorId: visitorId(),
    internal: internalDevice(),
  });
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null);
  return typeof body?.id === 'string' ? body.id : null;
}

export async function addContext(id: string, context: PlanContext): Promise<boolean> {
  const res = await post('/api/plan/context', { id, visitorId: visitorId(), context });
  return res?.status === 204;
}

export async function forgetPlans(): Promise<number | null> {
  const res = await post('/api/plan/forget', { visitorId: visitorId() });
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null);
  return typeof body?.removed === 'number' ? body.removed : null;
}

const CONTRIBUTED = 'ioi-plan-filed';

/** Whether this browser has filed a plan, so "Forget my plan" only shows when there's something to forget. */
export function markContributed(on: boolean) {
  try {
    if (on) localStorage.setItem(CONTRIBUTED, '1');
    else localStorage.removeItem(CONTRIBUTED);
  } catch {}
}
export function hasContributed(): boolean {
  try {
    return localStorage.getItem(CONTRIBUTED) === '1';
  } catch {
    return false;
  }
}
