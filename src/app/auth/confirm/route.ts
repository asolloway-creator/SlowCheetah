import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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
  const next = searchParams.get('next') ?? '/deal';

  const supabase = await createClient();

  let message: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    message = error.message;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    message = error.message;
  } else {
    message =
      searchParams.get('error_description') ?? 'That sign-in link is missing its token.';
  }

  const errorUrl = new URL('/auth/error', origin);
  if (message) errorUrl.searchParams.set('message', message);
  return NextResponse.redirect(errorUrl);
}
