'use client';

import { useEffect, useState } from 'react';
import TweenedMoney from '@/components/TweenedMoney';
import { fmtMoney, fmtSigned } from '@/lib/format';
import type { OutcomeCopy, OutcomeState } from '@/components/opening';

/**
 * The state name and the one big figure (plus its secondary, when a state
 * has one). The animated figure is aria-hidden; a debounced live region
 * carries the plain-text summary, sentence and detail included, since those
 * render elsewhere on the card.
 */
export default function Outcome({ copy, state }: { copy: OutcomeCopy; state: OutcomeState }) {
  const [live, setLive] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      const name = copy.name.replace(/\.$/, '');
      const secondary = copy.secondary
        ? ` ${copy.secondary.label}: ${
            copy.secondary.signed ? fmtSigned(copy.secondary.value) : (copy.secondary.format ?? fmtMoney)(copy.secondary.value)
          }${copy.secondary.caption ? `, ${copy.secondary.caption}` : ''}.`
        : '';
      const detail = copy.detail ? ` ${copy.detail}` : '';
      setLive(`${name}. ${copy.figureText ? `${copy.figureText}. ` : ''}${copy.sentence}${detail}${secondary}`);
    }, 300);
    return () => clearTimeout(t);
  }, [copy.name, copy.figureText, copy.sentence, copy.detail, copy.secondary]);

  return (
    <div className="outcome">
      <h2 id="outcome-h" key={state} className="outcome-name fade-up">
        <span className="sq sq-pays" aria-hidden="true" />
        {copy.name}
      </h2>
      {copy.figure !== null ? (
        <p id="outcome-figure" className={`outcome-figure is-${copy.figureTone}`}>
          <span aria-hidden="true">
            <TweenedMoney value={copy.figure} signed={copy.signed} />
          </span>
          {copy.caption && (
            <span key={state} className="outcome-caption fade-up">
              {copy.caption}
            </span>
          )}
        </p>
      ) : (
        <p className="outcome-empty">{copy.sentence}</p>
      )}
      {copy.secondary && (
        <p key={`${state}-secondary`} className="outcome-secondary fade-up" aria-hidden="true">
          <span className="outcome-secondary-label">{copy.secondary.label}</span>
          <span className={`outcome-secondary-figure is-${copy.secondary.tone}`}>
            <TweenedMoney value={copy.secondary.value} signed={copy.secondary.signed} format={copy.secondary.format} />
          </span>
          {copy.secondary.caption && <span className="outcome-secondary-caption">{copy.secondary.caption}</span>}
        </p>
      )}
      <div className="sr-only" aria-live="polite">
        {live}
      </div>
    </div>
  );
}
