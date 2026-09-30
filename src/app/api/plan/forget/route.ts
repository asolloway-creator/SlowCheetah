import * as z from 'zod/v4';
import { serviceClient } from '@/lib/supabase/service';
import { json, readJson, sessionUserId, UUID } from '@/lib/plan-record/server';

const Body = z.object({ visitorId: z.string().regex(UUID) });

/**
 * "Forget my plan": removes every plan this browser confirmed, and every plan
 * on the signed-in account. Statistics already published can't be un-counted,
 * but nothing new is ever built from these rows again.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await readJson(request, 500));
  if (!parsed.success) return json({ error: 'bad_request' }, 400);
  const db = serviceClient();
  if (!db) return json({ error: 'unavailable' }, 503);

  const userId = await sessionUserId();
  const owner = userId
    ? `visitor_id.eq.${parsed.data.visitorId},user_id.eq.${userId}`
    : `visitor_id.eq.${parsed.data.visitorId}`;
  const { data, error } = await db.from('plan_records').delete().or(owner).select('id');
  if (error) return json({ error: 'failed' }, 500);
  return json({ removed: data?.length ?? 0 });
}
