import * as z from 'zod/v4';
import { PlanContext } from '@/lib/plan-record/schema';
import { serviceClient } from '@/lib/supabase/service';
import { json, readJson, sessionUserId, UUID } from '@/lib/plan-record/server';

const Body = z.object({
  id: z.string().regex(UUID),
  visitorId: z.string().regex(UUID),
  context: PlanContext,
});

/** The optional "a little more about you" answers, added to a plan already confirmed. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await readJson(request, 4000));
  if (!parsed.success) return json({ error: 'bad_request' }, 400);
  const { id, visitorId, context } = parsed.data;
  const db = serviceClient();
  if (!db) return json({ error: 'unavailable' }, 503);

  const userId = await sessionUserId();
  const owner = userId ? `visitor_id.eq.${visitorId},user_id.eq.${userId}` : `visitor_id.eq.${visitorId}`;
  const { data, error } = await db
    .from('plan_records')
    .update({ ...context, updated_at: new Date().toISOString() })
    .eq('id', id)
    .or(owner)
    .select('id');
  if (error) return json({ error: 'failed' }, 500);
  if (!data?.length) return json({ error: 'not_found' }, 404);
  return new Response(null, { status: 204 });
}
