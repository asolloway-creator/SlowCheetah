'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import NavLink from '@/components/NavLink';
import { ACCOUNT_KEY } from '@/lib/demo-flag';

const noop = () => () => {};
const hasAccount = () => {
  try {
    return localStorage.getItem(ACCOUNT_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * The signed-out masthead's links. A first visit gets "Sign in" and "Put your
 * plan in". A browser that has signed in before (lib/demo-flag.ts) gets
 * "Sign in" as the one button: their plan is already in their account. The
 * server can't tell them apart, so until this hydrates the first-visit links
 * stay hidden from anyone marked by the head script (`ask-pending`).
 */
export default function SignedOutAsk({ current }: { current: string }) {
  const account = useSyncExternalStore(noop, hasAccount, () => false);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  return (
    <div className={`auth${hydrated ? '' : ' ask-pending'}`}>
      {current === '/' ? (
        <a className="nav-link hide-sm" href="#how">
          How it works
        </a>
      ) : (
        <NavLink className="nav-link hide-sm" href="/">
          &larr; Back to your deal
        </NavLink>
      )}
      {account ? (
        current !== '/login' && (
          <Link className="btn btn-primary" href="/login">
            Sign in
          </Link>
        )
      ) : (
        <>
          <NavLink className="nav-link" href="/login" aria-current={current === '/login' ? 'page' : undefined}>
            Sign in
          </NavLink>
          {/* Not on the pages where the ask is already the page itself. */}
          {current !== '/plan' && current !== '/login' && (
            <Link className="btn btn-primary" href="/?plan=1" scroll={false}>
              Put your plan in
            </Link>
          )}
        </>
      )}
    </div>
  );
}
