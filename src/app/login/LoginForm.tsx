'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/lib/track';

/**
 * Passwordless sign-in, and creating an account (`mode="signup"`, the start of
 * "Put your plan in"): the same email, link and code either way. Signing in
 * never makes an account; an email without one is pointed to creating it.
 * The email carries a link and a code. The link works
 * in any browser on any device (it's verified by token hash in
 * app/auth/confirm, not tied to this browser), and the code signs you in
 * right here: what you need when the email opens on your phone and IOI is
 * open on your laptop, or the other way round.
 */
export default function LoginForm({ mode }: { mode: 'signin' | 'signup' }) {
  const signup = mode === 'signup';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setCodeError('Enter the code from the email.');
    setChecking(true);
    setCodeError(null);
    let failed = false;
    let offline = false;
    try {
      const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token, type: 'email' });
      failed = Boolean(error);
      offline = Boolean(error && /fetch|network/i.test(error.message));
    } catch {
      failed = offline = true;
    }
    if (failed) {
      setChecking(false);
      setCodeError(
        offline
          ? 'Could not reach IOI. Check your connection and try again.'
          : 'That code didn’t work. Check it, or ask for a new email.',
      );
      return;
    }
    router.replace('/');
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNoAccount(false);
    setStatus('sending');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm`, shouldCreateUser: signup },
    });

    if (error && !signup && /signups not allowed|not found|no user/i.test(error.message)) {
      setNoAccount(true);
      setStatus('idle');
      return;
    }
    if (error) {
      // The service's own wording ("Failed to fetch", rate-limit seconds) reads
      // as a raw error next to everything else here.
      setError(
        /fetch|network/i.test(error.message)
          ? 'Could not reach IOI. Check your connection and try again.'
          : /security purposes|rate limit|too many/i.test(error.message)
            ? 'You just asked for one. Give it a minute, then try again.'
            : 'That didn’t send. Check the address and try again.',
      );
      setStatus('idle');
      return;
    }
    track('signin_started', 'site');
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="auth-page">
        <h1 className="page-title">Check your email</h1>
        <p className="auth-copy">
          We sent a link and a code to <strong>{email}</strong>. Open the link on any device, or enter the code here.
        </p>
        <form className="auth-form" onSubmit={onCode}>
          {codeError && <p className="auth-error">{codeError}</p>}
          <div className="field">
            <label className="field-label" htmlFor="code">
              Code from the email
            </label>
            <div className="field-box">
              <input
                id="code"
                className="field-input auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={checking}>
            {checking ? (signup ? 'Creating your account…' : 'Signing in…') : signup ? 'Create my account' : 'Sign in'}
          </button>
        </form>
        <p className="auth-copy">
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              setStatus('idle');
              setCode('');
              setCodeError(null);
            }}
          >
            Use a different email
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1 className="page-title">{signup ? 'Create your account' : 'Sign in'}</h1>
      <p className="auth-copy">
        {signup
          ? 'Then tell IOI how you’re paid, once, and every deal you price runs on your plan. We’ll email you a link and a code; there’s no password.'
          : 'Your plan, your deals and where you stand, on any device. We’ll email you a link and a code; there’s no password.'}
      </p>
      <form className="auth-form" onSubmit={onSubmit} noValidate={false}>
        {error && <p className="auth-error">{error}</p>}
        {noAccount && (
          <p className="auth-error">
            There’s no IOI account for that email yet.{' '}
            <Link className="btn-text" href="/signup">
              Create one
            </Link>
          </p>
        )}
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
          {status === 'sending' ? 'Sending…' : signup ? 'Create my account' : 'Send sign-in link'}
        </button>
      </form>
      <p className="auth-copy auth-switch">
        {signup ? 'Already have an account? ' : 'New to IOI? '}
        <Link className="btn-text" href={signup ? '/login' : '/signup'}>
          {signup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </div>
  );
}
