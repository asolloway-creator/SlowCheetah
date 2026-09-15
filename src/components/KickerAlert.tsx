import type { CrossEffectCopy } from '@/components/opening';

/**
 * The cross-effect callout — this deal crosses the plan's own accelerator
 * fine, but it's quietly costing a quarterly kicker tier, worth more.
 * Renders nothing when there's nothing to say: no quarterly_kicker
 * configured, or this deal doesn't cost a tier. Never a permanently-visible
 * box, same as every other conditional callout on this page.
 */
export default function KickerAlert({ copy }: { copy: CrossEffectCopy | null }) {
  if (!copy) return null;
  return (
    <div className="kicker-alert" role="status">
      <p className="kicker-alert-label">{copy.label}</p>
      <p className="kicker-alert-sentence">{copy.sentence}</p>
    </div>
  );
}
