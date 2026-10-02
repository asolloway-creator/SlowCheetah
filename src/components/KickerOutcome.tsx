'use client';

import { useEffect, useRef, useState } from 'react';
import TweenedMoney from '@/components/TweenedMoney';
import type { KickerOutcomeCopy } from '@/components/opening';

/**
 * The deal's effect on the quarterly bonus: green when it unlocks or keeps
 * a tier, red when it costs one (with the mechanism spelled out). Renders
 * nothing when this deal isn't decisive either way. Flipping from one to the
 * other plays a short shake (to red) or settle (back to green), never on
 * first paint. `compact` drops the red card's mechanism sentence, for the
 * landing card, where the story's own narration carries it.
 */
export default function KickerOutcome({ copy, compact = false }: { copy: KickerOutcomeCopy | null; compact?: boolean }) {
  const tone = copy?.tone ?? null;
  const prev = useRef(tone);
  const [anim, setAnim] = useState<'' | 'is-flipping' | 'is-settling'>('');
  useEffect(() => {
    if (prev.current && tone && prev.current !== tone) {
      setAnim(tone === 'red' ? 'is-flipping' : 'is-settling');
    }
    prev.current = tone;
  }, [tone]);

  if (!copy) return null;

  return (
    <div
      className={`kicker-outcome is-${copy.tone}${anim ? ` ${anim}` : ''}`}
      role={copy.tone === 'red' ? 'status' : undefined}
      onAnimationEnd={() => setAnim('')}
    >
      <p className="kicker-outcome-label">{copy.label}:</p>
      <p className="kicker-outcome-figure">
        <TweenedMoney value={copy.value} />
      </p>
      {copy.tone === 'red' && !compact && <p className="kicker-outcome-sentence">{copy.sentence}</p>}
    </div>
  );
}
