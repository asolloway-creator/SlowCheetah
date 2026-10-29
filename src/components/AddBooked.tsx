'use client';

import { useState } from 'react';
import type { DealAccount } from '@/lib/calc';
import AccountPicker, { type AccountChoice } from '@/components/AccountPicker';
import NumField from '@/components/NumField';

export type BookedInput = {
  name: string;
  /** A year of subscription, the dollars quota counts. */
  arr: number;
  bookedOn: string;
  account: { id: string } | { id: null; name: string; oneDecision: boolean } | null;
  kind: 'deal' | 'upsell';
};

/**
 * ARR booked without a quote: an upsell to an account sold in an earlier
 * month, or anything else that already counts toward quota and just needs
 * to be in. No discount, no one-time lines (the pricing happened
 * elsewhere), so it counts toward quota and commission and stays out of the
 * discount numbers. The account is a name: one IOI has seen, or a new one.
 */
export default function AddBooked({
  accounts,
  calendar,
  onAdd,
}: {
  accounts: DealAccount[];
  calendar: { today: string; periodStart: string };
  onAdd: (i: BookedInput) => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [arr, setArr] = useState(0);
  const [day, setDay] = useState(calendar.today);
  const [kind, setKind] = useState<'deal' | 'upsell'>('upsell');
  const [account, setAccount] = useState<BookedInput['account']>(null);
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  function pick(c: AccountChoice) {
    if ('account' in c) {
      setAccount({ id: c.account.id });
      setAccountName(c.account.name);
    } else {
      setAccount({ id: null, name: c.name, oneDecision: true });
      setAccountName(c.name);
    }
  }

  function reset() {
    setName('');
    setArr(0);
    setDay(calendar.today);
    setAccount(null);
    setAccountName('');
    setError(null);
  }

  async function save() {
    if (!(arr > 0)) return setError('Enter the ARR.');
    setBusy(true);
    setError(null);
    let res: { error?: string };
    try {
      res = await onAdd({ name: name.trim() || accountName, arr, bookedOn: day, account, kind });
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setBusy(false);
    if (res.error) return setError(res.error);
    reset();
    setOpen(false);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 5000);
  }

  if (!open) {
    return (
      <p className="ab-line">
        <button type="button" className="btn-text" onClick={() => setOpen(true)}>
          Add booked ARR
        </button>
        <span>An upsell or anything already booked, without a quote.</span>
        {added && <span className="is-green">Added.</span>}
      </p>
    );
  }
  return (
    <div className="ab" role="group" aria-label="Add booked ARR">
      <p className="ab-note">Counts toward quota and commission. Left out of your discount numbers, since there is no quote.</p>
      <div className="ab-grid">
        <div className="field">
          <label className="field-label" htmlFor="abName">
            What was booked
          </label>
          <div className="field-box">
            <input
              id="abName"
              className="field-input"
              maxLength={80}
              placeholder="Optional. Defaults to the account"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <NumField id="abArr" label="ARR" prefix="$" suffix="a year" value={arr} onChange={setArr} blankZero />
        <div className="field">
          <label className="field-label" htmlFor="abDay">
            Date closed
          </label>
          <div className="field-box">
            <input
              id="abDay"
              className="field-input"
              type="date"
              min={calendar.periodStart}
              max={calendar.today}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="abAcct">
            Account
          </label>
          {account ? (
            <p className="ab-acct">
              <b>{accountName}</b>
              <button
                type="button"
                className="btn-text"
                onClick={() => {
                  setAccount(null);
                  setAccountName('');
                }}
              >
                Change
              </button>
            </p>
          ) : (
            <AccountPicker id="abAcct" accounts={accounts} onPick={pick} />
          )}
        </div>
      </div>
      <div className="ab-foot">
        <span className="seg" role="group" aria-label="What it is">
          <button type="button" aria-pressed={kind === 'upsell'} onClick={() => setKind('upsell')}>
            Upsell
          </button>
          <button type="button" aria-pressed={kind === 'deal'} onClick={() => setKind('deal')}>
            New business
          </button>
        </span>
        <span className="ab-acts">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Adding…' : 'Add it'}
          </button>
          <button
            type="button"
            className="btn-text"
            disabled={busy}
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Cancel
          </button>
        </span>
      </div>
      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
