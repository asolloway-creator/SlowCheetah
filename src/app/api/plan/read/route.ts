import { PlanRecord } from '@/lib/plan-record/schema';
import { MAX_DESCRIPTION, readPlan } from '@/lib/plan-record/reader';
import { signRead } from '@/lib/plan-record/token';
import { BOT, json, readJson, readerLimits, UUID, withinLimits } from '@/lib/plan-record/server';

// A read takes a few seconds, occasionally longer; the reader's own timeout is 40s.
export const maxDuration = 60;

/**
 * A rep's description in, a plan record out. The words are sent to Claude
 * and then dropped: never stored, never logged. What comes back is signed so
 * the confirm step can tell a genuine read from an invented one.
 */
export async function POST(request: Request) {
  if (BOT.test(request.headers.get('user-agent') ?? '')) return json({ error: 'unavailable' }, 403);
  const b = await readJson(request, 40_000);
  if (!b) return json({ error: 'bad_request' }, 400);

  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text) return json({ error: 'empty' }, 400);
  if (text.length > MAX_DESCRIPTION) return json({ error: 'too_long' }, 413);
  if (!UUID.test(String(b.visitorId))) return json({ error: 'bad_request' }, 400);

  let current: PlanRecord | undefined;
  if (b.mode === 'correct') {
    const parsed = PlanRecord.safeParse(b.current);
    if (!parsed.success) return json({ error: 'bad_request' }, 400);
    current = parsed.data;
  }

  if (!(await withinLimits(readerLimits(request, String(b.visitorId))))) return json({ error: 'busy' }, 429);

  const result = await readPlan(text, { current });
  if (!result.ok) {
    const status = result.error === 'no_key' ? 503 : result.error === 'refused' ? 422 : 502;
    return json({ error: result.error === 'no_key' ? 'unavailable' : result.error }, status);
  }
  if (!('record' in result)) return json({ kind: result.kind });

  const read = { record: result.record, meta: result.meta };
  return json({ kind: result.kind, ...read, token: signRead(read) });
}
