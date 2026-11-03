'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/app/icons';

export type FindItem = {
  key: string;
  /** The deal's or account's name. */
  label: string;
  /** What it is: "Open quote · Juniper Hall", "Closed Won · Nov 14". */
  sub: string;
  /** Other words it answers to (its account's name). */
  also?: string;
  href: string;
};

/** How many matches the list shows. */
const SHOWN = 8;

/** Matches for what's typed: names that start with it first, then names that
 *  contain it, then accounts that do. Exported for the tests. */
export function findMatches(items: FindItem[], q: string): FindItem[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const rank = (i: FindItem) => {
    const name = i.label.toLowerCase();
    if (name.startsWith(t)) return 0;
    if (name.split(/\s+/).some((w) => w.startsWith(t))) return 1;
    if (name.includes(t)) return 2;
    if (i.also?.toLowerCase().includes(t)) return 3;
    return -1;
  };
  return items
    .map((i) => ({ i, r: rank(i) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i.label.localeCompare(b.i.label))
    .slice(0, SHOWN)
    .map((x) => x.i);
}

/**
 * Find a deal by name from anywhere: open quotes, accounts and booked deals.
 * "/" jumps into it, arrows move, Enter opens, Escape closes. On a phone it
 * opens as a sheet across the top.
 */
export default function FindDeal({ items }: { items: FindItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const id = useId();
  const matches = findMatches(items, q);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const slash = e.key === '/' || (e.code === 'Slash' && !e.shiftKey);
      if (slash && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => input.current?.focus());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQ('');
    setAt(0);
  }
  function go(i: FindItem) {
    close();
    router.push(i.href);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAt((a) => Math.min(a + 1, Math.max(0, matches.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAt((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && matches[at]) {
      e.preventDefault();
      go(matches[at]);
    }
  }

  if (!items.length) return null;
  const listId = `${id}-list`;
  return (
    <div className={`fd${open ? ' is-open' : ''}`} ref={box}>
      {!open ? (
        <button
          type="button"
          className="fd-btn"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => input.current?.focus());
          }}
          aria-label="Find a deal"
        >
          <Icon name="search" />
          <span className="fd-btn-label">Find a deal</span>
          <kbd className="fd-kbd" aria-hidden="true">
            /
          </kbd>
        </button>
      ) : (
        <div className="fd-panel">
          <div className="fd-field">
            <Icon name="search" />
            <input
              ref={input}
              className="fd-input"
              type="text"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls={listId}
              aria-activedescendant={matches[at] ? `${id}-${at}` : undefined}
              aria-autocomplete="list"
              aria-label="Find a deal or account by name"
              placeholder="A deal or account"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setAt(0);
              }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="fd-close" onClick={close} aria-label="Close search">
              <Icon name="close" />
            </button>
          </div>
          {q.trim() && (
            <ul className="fd-list" id={listId} role="listbox" aria-label="Matches">
              {matches.length ? (
                matches.map((m, i) => (
                  <li
                    key={m.key}
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={i === at}
                    className={`fd-item${i === at ? ' is-at' : ''}`}
                    onMouseEnter={() => setAt(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(m);
                    }}
                  >
                    <span className="fd-name">{m.label}</span>
                    <span className="fd-sub">{m.sub}</span>
                  </li>
                ))
              ) : (
                <li className="fd-none" role="presentation">
                  Nothing by that name.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
