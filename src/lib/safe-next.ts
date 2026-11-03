/**
 * Where to send someone after they sign in: a path on this site, or home.
 * Anything else ("//elsewhere.com", "https://…", "/\\elsewhere") would make
 * the sign-in link a way to bounce people off-site, so it's refused.
 */
export function safeNext(v: string | null | undefined): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\r\n]/.test(v)) return '/';
  return v;
}

/** The cookie that carries it from the sign-in form to the emailed link. */
export const NEXT_COOKIE = 'ioi-next';
