'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Assumed, Mapping, Topic } from '@/lib/plan-record/map';
import type { CalcChoices, PlanRecord } from '@/lib/plan-record/schema';
import { MAX_DESCRIPTION } from '@/lib/plan-record/limits';
import {
  assumedText,
  fixQuestions,
  gapsToAsk,
  limitCopy,
  NOTE_TEXT,
  question,
  readback,
  STATUS_LABEL,
  workedExample,
} from '@/lib/plan-record/copy';
import { fmtMoney } from '@/lib/format';
import QuestionField from './QuestionField';
import { MicButton } from './Dictation';

/**
 * Step two: the plan read back in IOI's words, for the person to check.
 * Questions first (only what the numbers can't run without), then the rules,
 * what IOI had to assume, and one worked example to hold against a real
 * paycheck. Nothing counts until they confirm.
 */
export default function CheckStep({
  record,
  mapping,
  onAnswer,
  onChoose,
  onCorrect,
  correcting,
  correctMessage,
  onConfirm,
  confirming,
  confirmError,
  onForm,
  onStartOver,
}: {
  record: PlanRecord;
  mapping: Mapping;
  onAnswer: (topic: Topic, index: number, value: string | number, how: 'answered' | 'corrected') => void;
  onChoose: (key: keyof CalcChoices) => void;
  onCorrect: (text: string) => Promise<boolean>;
  correcting: boolean;
  correctMessage: string | null;
  onConfirm: () => void;
  confirming: boolean;
  confirmError: string | null;
  onForm: () => void;
  onStartOver: () => void;
}) {
  const m = mapping;
  const asking = gapsToAsk(m.gaps);
  const groups = readback(record, m);
  const example = m.plan ? workedExample(m.plan) : null;
  const blocked = m.gaps.length > 0;

  return (
    <div className="cap">
      <h1 className="page-title">Here’s your plan.</h1>
      <p className="plan-intro">Make sure this is how you’re paid. If anything’s off, fix it here. Nothing counts until you confirm.</p>

      {asking.length > 0 && (
        <section className="cap-ask" aria-label="Questions">
          <h2 className="cap-ask-h">{asking.length === 1 ? 'One quick question' : 'Two quick questions'}</h2>
          {asking.map((g, i) => (
            <QuestionField
              key={`${g.topic}:${g.index}`}
              q={question(record, g.topic, g.index)}
              autoFocus={i === 0}
              onApply={(v) => onAnswer(g.topic, g.index, v, 'answered')}
            />
          ))}
        </section>
      )}

      {m.limits.map((l) => {
        const c = limitCopy(l, record);
        return (
          <section key={l} className="cap-limit">
            <h2 className="cap-limit-h">{c.title}</h2>
            <p>{c.body}</p>
            <div className="cap-limit-actions">
              {c.choice ? (
                <button type="button" className="btn btn-secondary" onClick={() => onChoose(c.choice!.key)}>
                  {c.choice.label}
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={onForm}>
                  Set rough numbers in the form
                </button>
              )}
            </div>
          </section>
        );
      })}

      <section className="cap-readback" aria-label="Your plan, read back">
        {groups.map((g) => (
          <div key={g.title} className="cap-group">
            <h2 className="cap-group-h">{g.title}</h2>
            <ul>
              {g.lines.map((l) => (
                <li key={`${l.area}:${l.index}`} className={`cap-line is-${l.status}`}>
                  <p className="cap-line-text">{l.text}</p>
                  {l.status !== 'calculated' && <span className="cap-pill">{STATUS_LABEL[l.status]}</span>}
                  {l.note && NOTE_TEXT[l.note] && <p className="cap-line-note">{NOTE_TEXT[l.note]}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 && <p className="cap-line-text">We couldn’t pull any rules out of that yet.</p>}
      </section>

      {m.assumed.length > 0 && (
        <section className="cap-assumed" aria-label="What we assumed">
          <h2 className="cap-group-h">What we assumed</h2>
          <ul>
            {m.assumed.map((a) => (
              <AssumedRow key={`${a.topic}:${a.index}`} record={record} a={a} m={m} onAnswer={onAnswer} />
            ))}
          </ul>
        </section>
      )}

      {example && (
        <section className="cap-example" aria-label="A worked example">
          <p className="eyebrow">
            <span className="mark-dot" aria-hidden="true" />
            Your plan on one deal
          </p>
          <p className="cap-example-deal">On {example.deal}, your plan pays</p>
          <div className="cap-example-figs">
            <div className="cap-fig">
              <span className="cap-fig-label">{example.after === null ? 'On that deal' : 'Before your accelerator'}</span>
              <b className="cap-fig-value">{fmtMoney(example.before)}</b>
            </div>
            {example.after !== null && (
              <div className="cap-fig">
                <span className="cap-fig-label">Past your accelerator</span>
                <b className="cap-fig-value">{fmtMoney(example.after)}</b>
              </div>
            )}
          </div>
          {example.afterNote && <p className="cap-example-note">Past it, that deal pays more {example.afterNote}.</p>}
          {example.oneTime && (
            <p className="cap-example-note">
              A {fmtMoney(example.oneTime.amount)} setup fee on the same deal adds {fmtMoney(example.oneTime.adds)}.
            </p>
          )}
        </section>
      )}

      <CorrectBox busy={correcting} message={correctMessage} onCorrect={onCorrect} />

      {confirmError && (
        <p className="cap-msg is-error" role="alert">
          {confirmError}
        </p>
      )}
      <div className="cap-actions">
        <button type="button" className="btn btn-primary btn-lg" disabled={blocked || confirming} onClick={onConfirm}>
          {confirming ? 'Saving' : m.plan || blocked ? 'Yes, that’s my plan' : 'Save my plan'}
        </button>
        <button type="button" className="btn-text" onClick={onForm}>
          Adjust the numbers
        </button>
        <button type="button" className="btn-text cap-restart" onClick={onStartOver}>
          Start over
        </button>
      </div>
      {blocked && <p className="cap-hint">Answer the question{asking.length > 1 ? 's' : ''} above to confirm.</p>}
      <p className="cap-privacy">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>
          Your plan stays anonymous. Your words are discarded once they’re read, and your company and deals are never part of it.{' '}
          <Link href="/plans-and-privacy">How IOI handles your plan</Link>
        </span>
      </p>
    </div>
  );
}

function AssumedRow({
  record,
  a,
  m,
  onAnswer,
}: {
  record: PlanRecord;
  a: Assumed;
  m: Mapping;
  onAnswer: (topic: Topic, index: number, value: string | number, how: 'answered' | 'corrected') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="cap-assumed-row">
      <div className="cap-assumed-line">
        <p>{assumedText(record, a, m)}</p>
        <button type="button" className="btn-text" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Done' : 'Change'}
        </button>
      </div>
      {open && (
        <div className="cap-assumed-fix">
          {fixQuestions(record, a).map((q) => (
            <QuestionField key={`${q.topic}:${q.index}`} q={q} onApply={(v) => onAnswer(q.topic, q.index, v, 'corrected')} />
          ))}
        </div>
      )}
    </li>
  );
}

function CorrectBox({
  busy,
  message,
  onCorrect,
}: {
  busy: boolean;
  message: string | null;
  onCorrect: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const submit = async () => {
    if (!text.trim() || busy) return;
    if (await onCorrect(text.trim())) setText('');
  };
  return (
    <section className="cap-correct" aria-label="Correct something">
      <label htmlFor="cap-correct" className="cap-question-prompt">
        Something off? Say what to change.
      </label>
      <div className="cap-box is-small">
        <textarea
          id="cap-correct"
          className="cap-text"
          rows={2}
          maxLength={MAX_DESCRIPTION}
          placeholder="For example: it’s 12% after quota, not 15%."
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="cap-box-foot">
          <MicButton label="Say it" onText={(said) => setText((t) => `${t}${t && !/\s$/.test(t) ? ' ' : ''}${said}`)} />
          <button type="button" className="btn btn-secondary cap-update" disabled={!text.trim() || busy} onClick={submit}>
            {busy ? (
              <>
                <span className="cap-spinner is-dark" aria-hidden="true" />
                Updating
              </>
            ) : (
              'Update my plan'
            )}
          </button>
        </div>
      </div>
      {message && (
        <p className="cap-msg" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
