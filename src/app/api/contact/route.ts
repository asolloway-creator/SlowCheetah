import { CONTACT_LIMITS, EMAIL_RE } from '@/lib/contact';
import { BOT, ENV, contactLimits, json, readJson, withinLimits } from '@/lib/plan-record/server';

/** Where the contact form's messages go. */
const TO = 'asolloway@gmail.com';

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max + 1) : '';

/**
 * The contact form: first name, last name, email and a message of up to 150
 * characters, emailed to IOI through the same email service that sends
 * sign-in links (RESEND_API_KEY), with Reply-To set to the sender. Nothing is
 * stored. Bots are turned away, a hidden field catches form-filling scripts,
 * and sends are capped per network and per day.
 */
export async function POST(request: Request) {
  if (BOT.test(request.headers.get('user-agent') ?? '')) return json({ error: 'unavailable' }, 403);
  const b = await readJson(request, 4_000);
  if (!b) return json({ error: 'bad_request' }, 400);

  // Filled in only by scripts that fill every field: look sent, send nothing.
  if (typeof b.website === 'string' && b.website.trim()) return json({ ok: true });

  const firstName = clean(b.firstName, CONTACT_LIMITS.name);
  const lastName = clean(b.lastName, CONTACT_LIMITS.name);
  const email = clean(b.email, CONTACT_LIMITS.email);
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (!firstName || !lastName || !email || !message) return json({ error: 'missing' }, 400);
  if (
    firstName.length > CONTACT_LIMITS.name ||
    lastName.length > CONTACT_LIMITS.name ||
    email.length > CONTACT_LIMITS.email ||
    message.length > CONTACT_LIMITS.message
  )
    return json({ error: 'too_long' }, 413);
  if (!EMAIL_RE.test(email)) return json({ error: 'email' }, 400);

  const key = process.env.RESEND_API_KEY;
  if (!key) return json({ error: 'unavailable' }, 503);
  if (!(await withinLimits(contactLimits(request)))) return json({ error: 'busy' }, 429);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'IOI <noreply@tryioi.com>',
      to: [TO],
      reply_to: email,
      subject: `${ENV === 'production' ? '' : `[${ENV}] `}IOI contact: ${firstName} ${lastName}`,
      text: `${message}\n\nFrom: ${firstName} ${lastName} <${email}>\nSent from the contact form on tryioi.com`,
    }),
  }).catch(() => null);
  if (!res?.ok) return json({ error: 'send_failed' }, 502);
  return json({ ok: true });
}
