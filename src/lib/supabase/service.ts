import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * The app's one server-side secret key (SUPABASE_SECRET_KEY, "ioi-server" in
 * the Supabase dashboard). Used only to write and remove plan records and to
 * count requests to the AI reader: those tables have no policies, so the
 * public and signed-in users can't touch them directly. Everything else in
 * the app still runs as the signed-in user under row level security.
 *
 * Null when the key isn't configured, so callers can answer "not available"
 * instead of crashing.
 */
export function serviceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
