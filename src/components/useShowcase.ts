'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Plays the landing card's story on its own, once, when the card first comes
 * into view: the discount glides to what the customer asks for, past the
 * bonus line, holds there long enough to read the loss, then IOI's "Hold the
 * line" prompt lights up and pulls it back to the most the customer can get
 * with the bonus kept. Most visitors never touch a slider, so the card shows
 * them instead of asking them to.
 *
 * Drives the real deal state through `setDiscount`, never the slider's own
 * onChange, so none of it counts as the visitor's input: no "dirty", no
 * slider_drag or bonus_line_crossed events. The first real input from the
 * visitor (`takeOver`) stops it where it is and hands them the controls.
 * With reduced motion it skips straight to the end.
 */

export type Beat = 'ready' | 'ask' | 'hold' | 'done' | 'free';
export type Hint = '' | 'glow' | 'press';

/** Lets the hero's "watch a sample deal" link replay the card from anywhere on the page. */
export const SHOWCASE_EVENT = 'ioi:showcase';

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export function useShowcase({
  enabled,
  ask,
  hold,
  setDiscount,
  targetId,
}: {
  enabled: boolean;
  ask: number | null;
  hold: number | null;
  setDiscount: (pct: number) => void;
  targetId: string;
}) {
  const [beat, setBeat] = useState<Beat>('ready');
  const [hint, setHint] = useState<Hint>('');
  const run = useRef(0);
  const raf = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const played = useRef(false);

  // Cancels whatever is scheduled. Refs only, so effects can call it.
  const halt = useCallback(() => {
    run.current += 1;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);
  const stop = useCallback(() => {
    halt();
    setHint('');
  }, [halt]);

  const play = useCallback(async () => {
    if (ask === null || hold === null) return;
    stop();
    played.current = true;
    const id = run.current;
    const live = () => id === run.current;
    if (reducedMotion()) {
      setDiscount(hold);
      setBeat('done');
      return;
    }
    // A stopped run's promises never settle: stop() clears the timers and
    // the frame they'd resolve from, and the closure is simply dropped.
    const wait = (ms: number) =>
      new Promise<boolean>((resolve) => {
        timers.current.push(window.setTimeout(() => resolve(live()), ms));
      });
    const glide = (from: number, to: number, ms: number, ease: (p: number) => number) =>
      new Promise<boolean>((resolve) => {
        const t0 = performance.now();
        const frame = (ts: number) => {
          if (!live()) return;
          const p = Math.min(1, (ts - t0) / ms);
          setDiscount(p >= 1 ? to : Math.round((from + (to - from) * ease(p)) * 100) / 100);
          if (p < 1) {
            raf.current = requestAnimationFrame(frame);
          } else {
            raf.current = null;
            resolve(true);
          }
        };
        raf.current = requestAnimationFrame(frame);
      });

    // Paced so the bonus is lost about two seconds after the card comes into
    // view (on the sample, the glide crosses the line 82% of the way through),
    // then held long enough to read what it cost.
    setDiscount(0);
    setBeat('ask');
    if (!(await wait(250))) return;
    if (!(await glide(0, ask, 1450, easeInOut))) return;
    if (!(await wait(1800))) return;
    setBeat('hold');
    setHint('glow');
    if (!(await wait(1100))) return;
    setHint('press');
    if (!(await wait(170))) return;
    setHint('');
    if (!(await glide(ask, hold, 650, easeOut))) return;
    setBeat('done');
  }, [ask, hold, setDiscount, stop]);

  // Once, the first time most of the card is on screen.
  useEffect(() => {
    if (!enabled || ask === null || played.current) return;
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let t: number | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || played.current) return;
        played.current = true;
        io.disconnect();
        t = window.setTimeout(() => void play(), 350);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (t !== undefined) clearTimeout(t);
    };
  }, [enabled, ask, play, targetId]);

  // "Watch a sample deal" in the hero: bring the card into view and replay.
  useEffect(() => {
    if (!enabled) return;
    const onReplay = () => {
      const reduced = reducedMotion();
      document.getElementById(targetId)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      played.current = true;
      timers.current.push(window.setTimeout(() => void play(), reduced ? 0 : 450));
    };
    window.addEventListener(SHOWCASE_EVENT, onReplay);
    return () => window.removeEventListener(SHOWCASE_EVENT, onReplay);
  }, [enabled, play, targetId]);

  // Leaving the showcase (a plan just went in) or the page: stop mid-story.
  // The hint can stay as it is; nothing reads it outside the showcase.
  useEffect(() => {
    if (!enabled) halt();
  }, [enabled, halt]);
  useEffect(() => halt, [halt]);

  /** The visitor's own first input: stop where it is and let them drive. */
  const takeOver = useCallback(() => {
    if (beat === 'free') return;
    stop();
    setBeat('free');
  }, [beat, stop]);

  return { beat, hint, play, takeOver, playing: beat === 'ask' || beat === 'hold' };
}
