/**
 * First-party, anonymous product events. Never names, emails, or plan and
 * deal numbers: just which moment happened and in which context.
 *
 * context keeps the stock sample deal apart from real inputs, so demo play
 * can never inflate real usage:
 *  - 'sample'  the stock demo plan and sample deal
 *  - 'own'     an anonymous visitor's own plan (saved in their browser only)
 *  - 'account' a signed-in user
 *  - 'site'    page-level moments (visits, starting sign-in)
 */

export type TrackEvent =
  | 'visit'
  | 'slider_drag'
  | 'bonus_line_crossed'
  | 'plan_form_opened'
  | 'plan_saved'
  | 'deal_booked'
  | 'signin_started'
  | 'plan_read'
  | 'plan_confirmed'
  | 'quote_saved';

export type TrackContext = 'site' | 'sample' | 'own' | 'account';

export type VisitDetail = {
  path?: string;
  referrerHost?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  device?: 'mobile' | 'desktop';
};

const VISITOR = 'ioi-vid';
const SESSION = 'ioi-sid';
const INTERNAL = 'ioi-internal';

/** This browser's anonymous id: the same one analytics uses, and the key a
 *  confirmed plan is filed under until its owner signs in. */
export function visitorId(): string {
  return storedId(() => localStorage, VISITOR);
}

export function internalDevice(): boolean {
  return isInternal();
}

function storedId(store: () => Storage, key: string): string {
  try {
    const s = store();
    let v = s.getItem(key);
    if (!v) {
      v = crypto.randomUUID();
      s.setItem(key, v);
    }
    return v;
  } catch {
    return crypto.randomUUID();
  }
}

/** This browser belongs to the team: its events are recorded but excluded from every count. */
export function markInternal() {
  try {
    localStorage.setItem(INTERNAL, '1');
  } catch {}
}

function isInternal() {
  try {
    return localStorage.getItem(INTERNAL) === '1';
  } catch {
    return false;
  }
}

export function track(name: TrackEvent, context: TrackContext, detail: VisitDetail = {}) {
  if (typeof window === 'undefined') return;
  // Automated browsers (link unfurlers that run scripts, test runs) aren't visitors.
  if (navigator.webdriver) return;
  const body = JSON.stringify({
    name,
    context,
    visitorId: storedId(() => localStorage, VISITOR),
    sessionId: storedId(() => sessionStorage, SESSION),
    internal: isInternal(),
    ...detail,
  });
  try {
    const sent = navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }));
    if (sent) return;
  } catch {}
  fetch('/api/events', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(
    () => {},
  );
}

const fired = new Set<string>();

/** Once per page load: for moments that fire continuously, like dragging. */
export function trackOnce(name: TrackEvent, context: TrackContext) {
  const key = `${name}:${context}`;
  if (fired.has(key)) return;
  fired.add(key);
  track(name, context);
}
