'use client';

import { useState, type CSSProperties } from 'react';
import {
  isFixedTier,
  needsQuarterArr,
  periodLabel,
  quarterlyKickerSummary,
  type CompPlan,
  type Opening,
  type OpeningInput,
  type PeriodToDate,
  type QuarterToDate,
  type QuarterlyKickerTier,
} from '@/lib/calc';
import { standing, tierName } from '@/components/opening';
import { fmt, fmtCredit, fmtMoney, fmtPctShort } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import OpeningFields from '@/components/OpeningFields';

/**
 * The top of the home page: where the rep stands this period, always in view
 * above their pipeline. The nearest thing they can win or lose as the
 * headline (standing() in opening.ts), what they've booked toward quota, the
 * quota line with its accelerator steps, the Quarterly Bonus when the plan
 * has one, and what they'd booked before IOI (asked for in a card until it's
 * known). It replaces the separate Where you stand page.
 */
export default function StandingBand({
  plan,
  ptd,
  qtd,
  opening,
  onOpening,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  opening: Opening | null;
  onOpening: (o: OpeningInput) => Promise<{ error?: string }>;
}) {
  const label = periodLabel(plan.period);
  const s = standing(plan, ptd, qtd, label);
  const pctQ = plan.quota > 0 ? Math.round((ptd.creditBooked / plan.quota) * 100) : 0;
  const started = opening !== null && (opening.credit > 0 || (opening.quarterArr ?? 0) > 0);
  return (
    <section className="standing" aria-labelledby="standing-h">
      <div className="container">
        <div className="standing-grid">
          <div className="standing-copy">
            <p className="hero-chip">
              <span className="mark-dot" aria-hidden="true" />
              Where you stand · {label}
            </p>
            <h1 id="standing-h" className="standing-h">
              {s.head.map((h, i) =>
                h.hl ? (
                  <span key={i} className="hero-hl">
                    {h.text}
                  </span>
                ) : (
                  <span key={i}>{h.text}</span>
                ),
              )}
            </h1>
            <p className="standing-lede">{s.lede}</p>
          </div>
          <div className="standing-lines">
            <div className="standing-card">
              <p className="standing-figure">
                <b>{fmtCredit(plan, ptd.creditBooked)}</b>{' '}
                {plan.quota_basis === 'arr' ? `booked toward your ${fmtMoney(plan.quota)} quota` : `of ${fmtCredit(plan, plan.quota)}`},{' '}
                {pctQ}% there
              </p>
              <QuotaLine mode="quarter" plan={plan} ptd={ptd} />
              {plan.quarterly_kicker && qtd && <BonusStanding plan={plan} qtd={qtd} />}
            </div>
            <StartingPoint plan={plan} opening={opening} started={started} label={label} onSave={onOpening} />
          </div>
        </div>
      </div>
    </section>
  );
}

const pct = (f: number) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`;
const vars = (o: Record<string, string>) => o as CSSProperties;

/**
 * The quarter against the Quarterly Bonus: new ARR booked toward its target,
 * a line with each tier marked, and one sentence on what it's worth so far or
 * what it takes to get there.
 */
function BonusStanding({ plan, qtd }: { plan: CompPlan; qtd: QuarterToDate }) {
  const kicker = plan.quarterly_kicker!;
  const s = quarterlyKickerSummary(plan, qtd);
  if (!s) return null;
  const tiers = [...kicker.tiers].sort((a, b) => a.attainmentPct - b.attainmentPct);
  const name = (t: QuarterlyKickerTier) => tierName(tiers.indexOf(t) + 1);
  const top = Math.max(tiers[tiers.length - 1].attainmentPct * 1.08, s.attainmentPct * 1.04, 110);
  const x = (attainment: number) => attainment / top;
  const attained = Math.round(s.attainmentPct * 10) / 10;
  const worth = (t: QuarterlyKickerTier) =>
    isFixedTier(t) ? fmtMoney(t.amount as number) : `+${fmtPctShort(t.kickerPct)} on the quarter’s SaaS commission`;
  const sentence = s.tier
    ? `${name(s.tier)} unlocked: ${worth(s.tier)}${isFixedTier(s.tier) ? '' : `, ${fmtMoney(s.bumpValue)} so far`}.${
        s.nextTier ? ` ${fmt(s.toNextTierArr)} more new ARR reaches the ${name(s.nextTier)}.` : ''
      }`
    : s.nextTier
      ? `${fmt(s.toNextTierArr)} more new ARR this quarter unlocks your ${name(s.nextTier)}: ${worth(s.nextTier)}.`
      : '';

  return (
    <section className="bonus-standing" aria-labelledby="bonus-h">
      <h2 id="bonus-h" className="section-h">
        Your Quarterly Bonus · {periodLabel('quarter')}
      </h2>
      <p className="bonus-figure">
        <b>{fmtMoney(qtd.saasArrBooked)}</b> new ARR, {fmtPctShort(attained)} of your {fmt(kicker.target)} target
      </p>
      <figure
        className={`line bonus-line${s.tier ? ' is-accelerated' : ''}`}
        aria-label={`New ARR this quarter: ${fmtPctShort(attained)} of the Quarterly Bonus target`}
      >
        <div className="line-mid">
          <span className="line-track" />
          <span className="line-post" />
          <span className="line-bar" style={vars({ '--w': pct(x(s.attainmentPct)) })} />
          {tiers.map((t) => (
            <span key={t.attainmentPct} className="line-post line-post-quota" style={vars({ '--x': pct(x(t.attainmentPct)) })} />
          ))}
        </div>
        <div className="line-bottom">
          <span className="line-origin">$0</span>
          {tiers.map((t) => (
            <span
              key={t.attainmentPct}
              className={`line-quota-label is-${x(t.attainmentPct) > 0.9 ? 'right' : 'centre'}`}
              style={vars({ '--x': pct(x(t.attainmentPct)) })}
            >
              {fmtPctShort(t.attainmentPct)}
            </span>
          ))}
        </div>
      </figure>
      {sentence && <p className="bonus-sentence">{sentence}</p>}
    </section>
  );
}

/** Add or change what was booked before IOI, right where it's counted. */
function StartingPoint({
  plan,
  opening,
  started,
  label,
  onSave,
}: {
  plan: CompPlan;
  opening: Opening | null;
  started: boolean;
  label: string;
  onSave: (o: OpeningInput) => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [credit, setCredit] = useState(opening?.credit ?? 0);
  const [quarterArr, setQuarterArr] = useState(opening?.quarterArr ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open && started) {
    return (
      <p className="quota-start">
        Includes {fmtCredit(plan, opening?.credit ?? 0)} you&rsquo;d booked before IOI.{' '}
        <button type="button" className="btn-text" onClick={() => setOpen(true)}>
          Change it
        </button>
      </p>
    );
  }
  if (!open) {
    return (
      <section className="start-card" aria-labelledby="start-card-h">
        <div>
          <h2 id="start-card-h" className="start-card-h">
            Booked deals in {label} before you started with IOI?
          </h2>
          <p>Add them so your quota, accelerator and bonus count from where you really are.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Add what you&rsquo;ve booked
        </button>
      </section>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    let res: { error?: string };
    try {
      res = await onSave({ credit, quarterArr: needsQuarterArr(plan) ? quarterArr : null });
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setBusy(false);
    if (res.error) return setError(res.error);
    setOpen(false);
  }

  return (
    <div className={started ? 'quota-start-edit' : 'start-card is-open'}>
      <h2 className={started ? 'section-h' : 'start-card-h'}>What you&rsquo;d booked in {label} before IOI</h2>
      <OpeningFields
        plan={plan}
        credit={credit}
        quarterArr={quarterArr}
        onCredit={setCredit}
        onQuarterArr={setQuarterArr}
        idPrefix="quota-opening"
      />
      {error && (
        <p className="cap-msg is-error" role="alert">
          {error}
        </p>
      )}
      <div className="cap-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-text" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
