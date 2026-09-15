import { fmtMoney } from '@/lib/format';
import type { KickerOutcomeCopy } from '@/components/opening';

/**
 * The deal's effect on the quarterly bonus — green when it keeps or
 * unlocks it, red when it costs it. One component for both, not two,
 * because they're the same event (this deal, measured against the tier
 * line) rather than a warning feature and a separate celebration feature.
 * Renders nothing when this deal isn't decisive either way: no
 * quarterly_kicker configured, or the tier outcome doesn't depend on it.
 * Never a permanently-visible box, same as every other conditional callout
 * on this page.
 *
 * Label/figure/sentence mirrors Outcome's own secondary-figure markup
 * (.outcome-secondary-*) deliberately — this is the page's other "money
 * moving" moment, and it should read as the same kind of event at a
 * different scale, not a smaller, competing one.
 */
export default function KickerOutcome({ copy }: { copy: KickerOutcomeCopy | null }) {
  if (!copy) return null;
  return (
    <div className={`kicker-outcome is-${copy.tone}`} role="status">
      <span className={`kicker-outcome-label is-${copy.tone}`}>{copy.label}</span>
      <span className={`kicker-outcome-figure is-${copy.tone}`}>{fmtMoney(copy.value)}</span>
      <span className="kicker-outcome-sentence">{copy.sentence}</span>
    </div>
  );
}
