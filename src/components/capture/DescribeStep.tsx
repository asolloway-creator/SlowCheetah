'use client';

import { useState } from 'react';
import { MAX_DESCRIPTION } from '@/lib/plan-record/limits';
import { MicButton } from './Dictation';

/**
 * Step one: how you get paid, in your own words. Three short questions and
 * an optional fourth, each easy to answer out loud, which keeps people on
 * the rules and away from pasting a plan document. The character limit
 * leaves no room for one either.
 */

const GUIDED = [
  { key: 'quota', label: 'What’s your quota, and what counts toward it?', example: 'For example: $150K of new ARR a quarter', required: true },
  { key: 'pays', label: 'What does a deal pay you?', example: 'For example: 10% of first-year value. Setup fees count at half.', required: true },
  { key: 'more', label: 'What changes when you hit quota, or go past it?', example: 'For example: every deal after quota pays 15%.', required: true },
  { key: 'else', label: 'Anything else?', example: 'For example: a 10% bonus on the quarter at 110%. Capped at 2x target.', required: false, hint: 'Bonuses, caps, clawbacks, when you’re paid. Optional.' },
] as const;
const PART_MAX = Math.floor(MAX_DESCRIPTION / GUIDED.length) - 20;

export type DescribeMessage = { tone: 'info' | 'error'; text: string } | null;

export default function DescribeStep({
  busy,
  message,
  onRead,
  onForm,
  titled = true,
}: {
  busy: boolean;
  message: DescribeMessage;
  onRead: (text: string) => void;
  onForm: () => void;
  titled?: boolean;
}) {
  const [parts, setParts] = useState<Record<string, string>>({});

  const guidedText = GUIDED.filter((q) => (parts[q.key] ?? '').trim())
    .map((q) => `${q.label} ${parts[q.key].trim()}`)
    .join('\n');
  const ready = GUIDED.filter((q) => q.required).some((q) => (parts[q.key] ?? '').trim());
  const submit = () => onRead(guidedText);
  const append = (prev: string, said: string, max: number) => `${prev}${prev && !/\s$/.test(prev) ? ' ' : ''}${said}`.slice(0, max);

  return (
    <form
      className="cap"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) submit();
      }}
    >
      {titled && (
        <>
          <h1 className="page-title">Tell us how you get paid.</h1>
          <p className="plan-intro">In your own words, the way you’d explain it to a friend. Just the rules and the numbers.</p>
        </>
      )}

        <ol className="cap-guided">
          {GUIDED.map((q, i) => (
            <li key={q.key} className="cap-q">
              <label htmlFor={`cap-${q.key}`} className="cap-q-label">
                <span className="cap-q-num" aria-hidden="true">
                  {i + 1}
                </span>
                {q.label}
              </label>
              {'hint' in q && <p className="cap-q-hint">{q.hint}</p>}
              <div className="cap-box is-small">
                <textarea
                  id={`cap-${q.key}`}
                  className="cap-text"
                  rows={2}
                  maxLength={PART_MAX}
                  placeholder={q.example}
                  value={parts[q.key] ?? ''}
                  disabled={busy}
                  onChange={(e) => setParts((p) => ({ ...p, [q.key]: e.target.value }))}
                />
                <div className="cap-box-foot">
                  <MicButton
                    label="Say it"
                    onText={(said) => setParts((p) => ({ ...p, [q.key]: append(p[q.key] ?? '', said, PART_MAX) }))}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>

      {message && (
        <p className={`cap-msg${message.tone === 'error' ? ' is-error' : ''}`} role={message.tone === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}

      <div className="cap-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={!ready || busy}>
          {busy ? (
            <>
              <span className="cap-spinner" aria-hidden="true" />
              Reading your plan
            </>
          ) : (
            'Read my plan'
          )}
        </button>
        <button type="button" className="btn-text" onClick={onForm} disabled={busy}>
          Fill in the numbers instead
        </button>
      </div>
      <p className="cap-privacy">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>
          Leave out your company and anything that identifies you. Your words go to Claude to be read, then they’re
          discarded. IOI keeps only your plan’s rules.
        </span>
      </p>
    </form>
  );
}
