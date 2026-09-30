'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAccountAction } from '@/app/actions';
import { markContributed } from '@/lib/plan-record/client';
import { visitorId } from '@/lib/track';

/** Delete the signed-in account, after one clear confirmation. */
export default function DeleteAccount() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (state === 'idle') {
    return (
      <button type="button" className="btn btn-secondary doc-danger" onClick={() => setState('confirm')}>
        Delete my account
      </button>
    );
  }
  return (
    <div className="doc-callout">
      <p>
        This deletes your account, your plan, your saved deals and every plan you’ve shared with IOI. It can’t be undone.
      </p>
      {error && <p className="is-red">{error}</p>}
      <div className="cap-forget-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={state === 'busy'}
          onClick={async () => {
            setState('busy');
            setError(null);
            const res = await deleteAccountAction(visitorId());
            if (res.error) {
              setError(res.error);
              setState('confirm');
              return;
            }
            markContributed(false);
            router.replace('/');
            router.refresh();
          }}
        >
          {state === 'busy' ? 'Deleting' : 'Delete everything'}
        </button>
        <button type="button" className="btn-text" disabled={state === 'busy'} onClick={() => setState('idle')}>
          Keep my account
        </button>
      </div>
    </div>
  );
}
