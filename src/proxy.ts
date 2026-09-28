import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // api/events is anonymous and hot (every tracked moment): no session to refresh there.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|opengraph-image|api/events|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
