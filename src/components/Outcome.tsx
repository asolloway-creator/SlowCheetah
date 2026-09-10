'use client';

import { useEffect, useState, type ReactNode } from 'react';
import TweenedMoney from '@/components/TweenedMoney';
import type { OutcomeCopy, OutcomeState } from '@/components/opening';

/**
 * The state name, the one big figure, the control beneath it (children), and
 * the sentence that explains the number. The animated figure is aria-hidden;
 * a debounced live region carries the plain-text summary instead.
 */
export default function Outcome({
  copy,
  state,
  children,
}: {
  copy: OutcomeCopy;
  state: OutcomeState;
  children?: ReactNode;
}) {
  const [live, setLive] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      const name = copy.name.replace(/\.$/, '');
      setLive(`${name}. ${copy.figureText ? `${copy.figureText}. ` : ''}${copy.sentence}`);
    }, 300);
    return () => clearTimeout(t);
  }, [copy.name, copy.figureText, copy.sentence]);

  return (
    <div className="outcome">
      <h2 id="outcome-h" key={state} className={`outcome-name fade-up${copy.nameTone === 'green' ? ' is-green' : ''}`}>
        {copy.name}
      </h2>
      {copy.figure !== null && (
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
      )}
      {children}
      <p className="outcome-sentence">{copy.sentence}</p>
      <div className="sr-only" aria-live="polite">
        {live}
      </div>
    </div>
  );
}
