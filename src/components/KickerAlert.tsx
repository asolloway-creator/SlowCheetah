import { fmtMoney } from '@/lib/format';
import type { CrossEffectCopy } from '@/components/opening';

/**
 * The cross-effect callout — this deal crosses the plan's own accelerator
 * fine, but it's quietly costing a quarterly bonus tier, worth more.
 * Renders nothing when there's nothing to say: no quarterly_kicker
 * configured, or this deal doesn't cost a tier. Never a permanently-visible
 * box, same as every other conditional callout on this page.
 *
 * Label/figure/sentence mirrors Outcome's own secondary-figure markup
 * (.outcome-secondary-*) deliberately — this is the page's other "money
 * leaving" moment, and it should read as the same kind of event at a
 * different scale, not a smaller, competing warning.
 */
export default function KickerAlert({ copy }: { copy: CrossEffectCopy | null }) {
  if (!copy) return null;
  return (
    <div className="kicker-alert" role="status">
      <span className="kicker-alert-label">{copy.label}</span>
      <span className="kicker-alert-figure">{fmtMoney(copy.value)}</span>
      <span className="kicker-alert-sentence">{copy.sentence}</span>
    </div>
  );
}
