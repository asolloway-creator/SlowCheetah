'use client';

import { useEffect } from 'react';
import { ACCOUNT_KEY } from '@/lib/demo-flag';

/** Signed in: this browser belongs to someone with an account (lib/demo-flag.ts). */
export default function RememberAccount() {
  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNT_KEY, '1');
    } catch {}
  }, []);
  return null;
}
