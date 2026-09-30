'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Speak instead of type, where the browser can turn speech into text
 * (Chrome, Edge, Safari). Where it can't, the button never renders; phones
 * still have the keyboard's own mic. Only finished phrases are added to the
 * text, so what lands in the box is exactly what the person can see and edit.
 */

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

export function useDictation(onText: (text: string) => void) {
  const supported = useSyncExternalStore(noop, () => ctor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const push = useRef(onText);
  useEffect(() => {
    push.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) return;
    const r = new C();
    r.continuous = true;
    r.interimResults = false;
    r.lang = 'en-US';
    r.onresult = (e) => {
      let said = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) said += e.results[i][0].transcript;
      }
      if (said.trim()) push.current(said.trim());
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setBlocked(true);
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
    };
    rec.current = r;
    setBlocked(false);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => rec.current?.stop(), []);

  return { supported, listening, blocked, start, stop };
}

export function MicButton({
  onText,
  label = 'Speak instead',
}: {
  onText: (text: string) => void;
  label?: string;
}) {
  const d = useDictation(onText);
  if (!d.supported) return null;
  return (
    <button
      type="button"
      className={`mic${d.listening ? ' is-listening' : ''}`}
      aria-pressed={d.listening}
      onClick={d.listening ? d.stop : d.start}
      title={d.blocked ? 'Microphone access is off for this site' : undefined}
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="7" y="2.5" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>{d.listening ? 'Listening. Tap to stop' : d.blocked ? 'Mic is blocked' : label}</span>
    </button>
  );
}
