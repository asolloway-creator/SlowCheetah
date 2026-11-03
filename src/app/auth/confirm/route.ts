import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { NEXT_COOKIE, safeNext } from '@/lib/safe-next';

/**
 * Magic-link landing route.
 *
 * Handles both shapes Supabase can send, so this works with the stock email
 * template and with the `{{ .TokenHash }}` template from the Supabase docs:
 *  - `?code=...`                    PKCE, exchanged for a session
 *  - `?token_hash=...&type=email`   OTP hash, verified directly
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  // Where they were headed when sign-in started (the form leaves it in a
  // short-lived cookie), kept to a path on this site.
  const raw = request.cookies.get(NEXT_COOKIE)?.value;
  let fromCookie: string | null = null;
  try {
    fromCookie = raw ? decodeURIComponent(raw) : null;
  } catch {}
  const next = safeNext(searchParams.get('next') ?? fromCookie);

  const supabase = await createClient();

  let message: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return arrive(new URL(next, origin));
    message = error.message;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return arrive(new URL(next, origin));
    message = error.message;
  } else {
    message =
      searchParams.get('error_description') ?? 'That sign-in link is missing its token.';
  }

  const errorUrl = new URL('/auth/error', origin);
  if (message) errorUrl.searchParams.set('message', message);
  return NextResponse.redirect(errorUrl);
}

/** Signed in: on to where they were going, and the cookie that said so goes. */
function arrive(url: URL) {
  const res = NextResponse.redirect(url);
  res.cookies.set(NEXT_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
