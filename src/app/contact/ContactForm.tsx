'use client';

import { useState, type FormEvent } from 'react';
import { CONTACT_LIMITS, EMAIL_RE } from '@/lib/contact';

const ERRORS: Record<string, string> = {
  missing: 'Fill in every field.',
  email: 'That email address doesn’t look right.',
  too_long: `Keep the message to ${CONTACT_LIMITS.message} characters.`,
  busy: 'Too many messages from here just now. Try again in a little while.',
};
const FALLBACK = 'Your message didn’t send. Try again in a minute, or email hello@tryioi.com.';

/** First name, last name, email and a message of up to 150 characters. */
export default function ContactForm({ email: signedIn }: { email: string }) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState(signedIn);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const left = CONTACT_LIMITS.message - message.length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim() || !email.trim() || !message.trim()) return setError(ERRORS.missing);
    if (!EMAIL_RE.test(email.trim())) return setError(ERRORS.email);
    setBusy(true);
    setError(null);
    let code: string | null = null;
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName: first, lastName: last, email, message, website }),
      });
      if (!res.ok) code = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'send_failed';
    } catch {
      code = 'send_failed';
    }
    setBusy(false);
    if (code) return setError(ERRORS[code] ?? FALLBACK);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="cap-msg contact-sent" role="status">
        Thanks, {first.trim()}. Your message is on its way, and the reply will come to {email.trim()}.
      </p>
    );
  }

  return (
    <form className="contact" onSubmit={submit} noValidate>
      <div className="field-grid">
        <label className="field">
          <span className="field-label">First name</span>
          <input
            className="field-input"
            name="firstName"
            autoComplete="given-name"
            maxLength={CONTACT_LIMITS.name}
            required
            value={first}
            onChange={(e) => {
            setFirst(e.target.value);
            setError(null);
          }}
          />
        </label>
        <label className="field">
          <span className="field-label">Last name</span>
          <input
            className="field-input"
            name="lastName"
            autoComplete="family-name"
            maxLength={CONTACT_LIMITS.name}
            required
            value={last}
            onChange={(e) => {
            setLast(e.target.value);
            setError(null);
          }}
          />
        </label>
      </div>
      <label className="field contact-row">
        <span className="field-label">Email</span>
        <input
          className="field-input"
          type="email"
          name="email"
          autoComplete="email"
          maxLength={CONTACT_LIMITS.email}
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
        />
      </label>
      <label className="field contact-row">
        <span className="field-head">
          <span className="field-label">Message</span>
          <span className={`contact-count${left <= 15 ? ' is-low' : ''}`} aria-live="polite">
            {left} left
          </span>
        </span>
        <textarea
          className="field-input contact-message"
          name="message"
          rows={4}
          maxLength={CONTACT_LIMITS.message}
          required
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setError(null);
          }}
        />
      </label>
      {/* Hidden from people; form-filling scripts fill it in. */}
      <label className="contact-trap" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      {error && (
        <p className="cap-msg is-error" role="alert">
          {error}
        </p>
      )}
      <div className="cap-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}
