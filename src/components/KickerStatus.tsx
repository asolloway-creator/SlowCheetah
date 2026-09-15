import { quarterlyKickerSummary, type CompPlan, type QuarterToDate } from '@/lib/calc';
import { fmtMoney, fmtPctShort } from '@/lib/format';
import { tierName } from '@/components/opening';

/**
 * Where the quarter actually stands, from deals already booked — the
 * grounding KickerOutcome needs so "below 105%" doesn't read as a number
 * the demo invented. Static: built from qtd alone, not the in-progress
 * deal, so it doesn't move as the discount slider does — that live verdict
 * is KickerOutcome's job, directly below this. "Already booked" is
 * deliberate wording: makes clear this is pre-deal context, not a second
 * live figure competing with the one under it.
 * Renders nothing under the same condition as KickerOutcome.
 */
export default function KickerStatus({ plan, qtd }: { plan: CompPlan; qtd: QuarterToDate | null }) {
  const kicker = plan.quarterly_kicker;
  if (!kicker || !qtd) return null;
  const s = quarterlyKickerSummary(plan, qtd);
  if (!s) return null;
  const sorted = [...kicker.tiers].sort((a, b) => a.attainmentPct - b.attainmentPct);
  const tierNum = (t: { attainmentPct: number }) => sorted.findIndex((x) => x.attainmentPct === t.attainmentPct) + 1;
  return (
    <p className="kicker-status">
      Already booked this quarter: {fmtMoney(qtd.saasArrBooked)} of {fmtMoney(kicker.target)} ({fmtPctShort(s.attainmentPct)})
      {s.tier
        ? ` · ${tierName(tierNum(s.tier))} locked in — +${fmtPctShort(s.tier.kickerPct)} on the quarter`
        : s.nextTier
          ? ` · ${fmtMoney(s.toNextTierArr)} to ${tierName(tierNum(s.nextTier))} (${fmtPctShort(s.nextTier.attainmentPct)})`
          : ''}
    </p>
  );
}
