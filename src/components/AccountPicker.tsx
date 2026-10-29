'use client';

import { useId, useState } from 'react';
import type { DealAccount } from '@/lib/calc';

export type AccountChoice = { account: DealAccount } | { name: string };

/**
 * Puts the deal on the card in an account: type, and the rep's accounts
 * that match come up to pick from (with how many open deals each has);
 * a name that isn't one of them starts a new account. Enter takes the
 * first match, or the new name.
 */
export default function AccountPicker({
  accounts,
  openCount,
  onPick,
  busy = false,
  id = 'acctName',
}: {
  accounts: DealAccount[];
  /** Open deals per account, shown beside each; left out where it doesn't apply. */
  openCount?: Record<string, number>;
  onPick: (c: AccountChoice) => void;
  busy?: boolean;
  /** The input's id, so two pickers on one page don't share it. */
  id?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const term = q.trim().toLowerCase();
  const matches = accounts
    .filter((a) => a.name.trim() && (!term || a.name.toLowerCase().includes(term)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 6);
  const exact = accounts.find((a) => a.name.trim().toLowerCase() === term);

  function pick(c: AccountChoice) {
    onPick(c);
    setQ('');
    setOpen(false);
  }

  return (
    <div className="acct-pick">
      <input
        id={id}
        className="acct-line-name"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={80}
        placeholder={accounts.length ? 'Type or pick an account' : 'Name an account'}
        value={q}
        disabled={busy}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') {
            e.preventDefault();
            if (exact) pick({ account: exact });
            else if (matches.length && term) pick({ account: matches[0] });
            else if (term) pick({ name: q.trim() });
          }
        }}
      />
      {open && (matches.length > 0 || term) && (
        <ul id={listId} className="acct-pick-list" role="listbox">
          {matches.map((a) => (
            <li key={a.id} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick({ account: a })}>
                <span>{a.name}</span>
                {openCount && (
                  <span className="acct-pick-n">
                    {openCount[a.id] ? `${openCount[a.id]} open ${openCount[a.id] === 1 ? 'deal' : 'deals'}` : 'no open deals'}
                  </span>
                )}
              </button>
            </li>
          ))}
          {term && !exact && (
            <li role="option" aria-selected={false}>
              <button type="button" className="is-new" onMouseDown={(e) => e.preventDefault()} onClick={() => pick({ name: q.trim() })}>
                New account: <b>{q.trim()}</b>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
