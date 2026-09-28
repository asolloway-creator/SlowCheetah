import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Refreshes the auth session, and gates /admin to admins. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser: it is what keeps the
  // session token fresh, and anything in between can log the user out at random.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The admin dashboard is the one gated area, decided here before anything
  // renders so everyone else gets a genuine 404 (the page repeats the check).
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const allowed = user ? (await supabase.rpc('is_admin')).data === true : false;
    if (!allowed) return new NextResponse('Not found', { status: 404, headers: { 'x-robots-tag': 'noindex' } });
  }

  // Demo-first: nothing else is gated. Signed-in users skip the login page.
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
