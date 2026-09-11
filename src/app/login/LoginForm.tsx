'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('sending');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });

    if (error) {
      setError(error.message);
      setStatus('idle');
      return;
    }
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="auth-page">
        <h1 className="page-title">Check your email</h1>
        <p className="auth-copy">
          We sent a sign-in link to <strong>{email}</strong>. Open it in this browser to finish signing in.
        </p>
        <p className="auth-copy">
          <button type="button" className="btn-text" onClick={() => setStatus('idle')}>
            Use a different email
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1 className="page-title">Sign in</h1>
      <p className="auth-copy">
        Keep your plan, your deals and where you stand &mdash; on any device. We&rsquo;ll email you a link;
        there&rsquo;s no password.
      </p>
      <form className="auth-form" onSubmit={onSubmit} noValidate={false}>
        {error && <p className="auth-error">{error}</p>}
        <div className="field">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <div className="field-box">
            <input
              id="email"
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
        </button>
      </form>
      <p className="auth-privacy">
        Your plan and your deals are stored under your account, visible only to you &mdash; nobody who runs this app
        can read them through it.
      </p>
    </div>
  );
}
