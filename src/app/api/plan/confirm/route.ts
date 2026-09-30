import * as z from 'zod/v4';
import { CalcChoices, FORMAT_VERSION, PlanRecord } from '@/lib/plan-record/schema';
import { mapRecord } from '@/lib/plan-record/map';
import { corrections } from '@/lib/plan-record/diff';
import { verifyRead } from '@/lib/plan-record/token';
import { serviceClient } from '@/lib/supabase/service';
import { BOT, confirmLimits, ENV, json, readJson, sessionUserId, UUID, withinLimits } from '@/lib/plan-record/server';

const Body = z.object({
  origin: z.enum(['described', 'form']),
  record: PlanRecord,
  choices: CalcChoices,
  read: z
    .object({
      record: PlanRecord,
      meta: z.object({ model: z.string().max(60), effort: z.string().max(20), prompt: z.string().max(20), served_by: z.string().max(60) }),
      token: z.string().max(200),
    })
    .nullable(),
  questions: z
    .array(z.object({ topic: z.string().max(40), how: z.enum(['answered', 'corrected']) }))
    .max(20),
  visitorId: z.string().regex(UUID),
  internal: z.boolean(),
});

/**
 * A person confirmed their plan: keep its rules. The calculable version and
 * coverage are recomputed here, never taken from the browser, and a read
 * only counts toward accuracy stats if its signature checks out.
 */
export async function POST(request: Request) {
  if (BOT.test(request.headers.get('user-agent') ?? '')) return json({ error: 'unavailable' }, 403);
  const raw = await readJson(request, 60_000);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: 'bad_request' }, 400);
  const b = parsed.data;

  const db = serviceClient();
  if (!db) return json({ error: 'unavailable' }, 503);
  if (!(await withinLimits(confirmLimits(request, b.visitorId)))) return json({ error: 'busy' }, 429);

  const mapping = mapRecord(b.record, b.choices);
  const verified = b.read ? verifyRead({ record: b.read.record, meta: b.read.meta }, b.read.token) : false;
  const userId = await sessionUserId();

  const { data, error } = await db
    .from('plan_records')
    .insert({
      visitor_id: b.visitorId,
      user_id: userId,
      origin: b.origin,
      format_version: FORMAT_VERSION,
      record: b.record,
      calc_choices: b.choices,
      calc_plan: mapping.plan,
      coverage: mapping.coverage,
      limits: mapping.limits,
      read_record: verified ? b.read!.record : null,
      read_verified: verified,
      reader: verified ? b.read!.meta : null,
      questions: b.questions,
      corrections: verified ? corrections(b.read!.record, b.record) : [],
      env: ENV,
      internal: b.internal,
    })
    .select('id')
    .single();
  if (error || !data) return json({ error: 'failed' }, 500);

  // Plans this browser confirmed before signing in belong to the account now,
  // so one person never counts twice.
  if (userId) {
    await db.from('plan_records').update({ user_id: userId }).eq('visitor_id', b.visitorId).is('user_id', null);
  }
  return json({ id: data.id });
}
