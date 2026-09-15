import { fmtMoney } from '@/lib/format';
import type { KickerOutcomeCopy } from '@/components/opening';

/**
 * The deal's effect on the quarterly bonus — one component, two registers,
 * not two components. Red is the moment worth stopping for: full card,
 * label, big figure, mechanism, and a short grounding clause. Green is a
 * fact worth confirming, not an alarm: one quiet line, same weight as a
 * plain status line, no card — mirrors how the accelerator line itself
 * doesn't shout when it's fine. Renders nothing when this deal isn't
 * decisive either way: no quarterly_kicker configured, or the tier outcome
 * doesn't depend on it.
 *
 * Previously two components (a static booked-quarter line plus a
 * red-only alert) — merged because splitting one fact into two reads was
 * exactly the "explain it twice" pattern driving the page's length up.
 */
export default function KickerOutcome({ copy }: { copy: KickerOutcomeCopy | null }) {
  if (!copy) return null;

  if (copy.tone === 'green') {
    return (
      <p className="kicker-outcome is-green">
        {copy.label} — {fmtMoney(copy.value)}
      </p>
    );
  }

  return (
    <div className="kicker-outcome is-red" role="status">
      <span className="kicker-outcome-label is-red">{copy.label}</span>
      <span className="kicker-outcome-figure is-red">{fmtMoney(copy.value)}</span>
      <span className="kicker-outcome-sentence">{copy.sentence}</span>
    </div>
  );
}
