'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * The signed-in rep's account button: their plan and signing out, out of the
 * way of the three places they work in (the tabs). Opens on click; Escape or
 * a click anywhere else closes it.
 */
export default function AccountMenu({ email, current }: { email: string; current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (email.trim()[0] ?? 'Y').toUpperCase();
  return (
    <div className="acct" ref={ref}>
      <button
        type="button"
        className={`acct-btn${current === '/plan' ? ' is-current' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="acct-initial" aria-hidden="true">
          {initial}
        </span>
        <span className="acct-label">Account</span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <p className="acct-email">{email}</p>
          <Link role="menuitem" className="acct-item" href="/plan" onClick={() => setOpen(false)}>
            Your plan
          </Link>
          <Link role="menuitem" className="acct-item" href="/contact" onClick={() => setOpen(false)}>
            Contact us
          </Link>
          <form action="/auth/signout" method="post">
            <button role="menuitem" type="submit" className="acct-item">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
