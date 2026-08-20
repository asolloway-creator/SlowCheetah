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
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
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
      <>
        <div className="notice ok">
          Link sent to <strong>{email}</strong>. Open it in this browser to finish
          signing in.
        </div>
        <button className="btn btn-quiet btn-lg" onClick={() => setStatus('idle')}>
          Use a different email
        </button>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="notice err">{error}</div>}
      <div className="field">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="txt"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          autoFocus
        />
      </div>
      <button
        className="btn btn-primary btn-lg"
        type="submit"
        disabled={status === 'sending' || !email.trim()}
        style={{ marginTop: 6 }}
      >
        {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  );
}
