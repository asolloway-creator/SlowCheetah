'use client';

import { useState, type CSSProperties } from 'react';
import type { DealRow } from '@/lib/queries';
import {
  isFixedTier,
  needsQuarterArr,
  periodLabel,
  periodOf,
  quarterlyKickerSummary,
  type CompPlan,
  type Opening,
  type OpeningInput,
  type PeriodToDate,
  type QuarterToDate,
  type QuarterlyKickerTier,
} from '@/lib/calc';
import { standing, tierName } from '@/components/opening';
import { fmt, fmtCredit, fmtMoney, fmtPctShort, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import OpeningFields from '@/components/OpeningFields';

/**
 * The top of the workspace: one plain sentence on the nearest thing the rep
 * can win or lose (standing() in opening.ts, its number the one highlight on
 * the page), then the numbers they check every time: booked toward quota on
 * its line with the accelerator steps, the Quarterly Bonus when the plan has
 * one, and commission booked this period. What they'd booked before IOI sits
 * under it, asked for until it's known.
 */
export default function Overview({
  plan,
  ptd,
  qtd,
  opening,
  deals,
  onOpening,
  onNew,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  opening: Opening | null;
  deals: DealRow[];
  onOpening: (o: OpeningInput) => Promise<{ error?: string }>;
  onNew: () => void;
}) {
  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const s = standing(plan, ptd, qtd, label);
  const pctQ = plan.quota > 0 ? Math.round((ptd.creditBooked / plan.quota) * 100) : 0;
  const started = opening !== null && (opening.credit > 0 || (opening.quarterArr ?? 0) > 0);
  const now = deals.filter((d) => periodOf(plan.period, d.created_at) === label);
  const paid = now.reduce((n, d) => n + d.commission_earned, 0);
  const lost = now.reduce((n, d) => n + d.money_left_on_table, 0);

  return (
    <section className="ov" aria-labelledby="ov-h">
      <div className="ov-head">
        <div className="ov-title">
          <h1 id="ov-h" className="ov-h">
            Pipeline <span className="ov-period">{label}</span>
          </h1>
          <p className="ov-status">
            {s.head.map((h, i) =>
              h.hl ? (
                <mark key={i} className="ov-hl">
                  {h.text}
                </mark>
              ) : (
                <span key={i}>{h.text}</span>
              ),
            )}
          </p>
        </div>
        <button type="button" className="btn btn-primary ov-new" onClick={onNew}>
          <span aria-hidden="true">+</span> New deal
        </button>
      </div>

      <div className="ov-kpis">
        <div className="kpi kpi-quota">
          <p className="app-label">Booked this {noun}</p>
          <p className="kpi-value">
            {fmtCredit(plan, ptd.creditBooked)}
            <span className="kpi-of">
              {plan.quota_basis === 'arr' ? `of ${fmtMoney(plan.quota)}` : `of ${fmtCredit(plan, plan.quota)}`} · {pctQ}%
            </span>
          </p>
          <QuotaLine mode="quarter" plan={plan} ptd={ptd} />
        </div>
        {plan.quarterly_kicker && qtd && <BonusKpi plan={plan} qtd={qtd} />}
        <div className="kpi">
          <p className="app-label">Commission booked</p>
          <p className="kpi-value">{fmtMoney(paid)}</p>
          <p className="kpi-note">
            {now.length} deal{now.length === 1 ? '' : 's'} this {noun}
            {lost > 0 && (
              <>
                {' · '}
                <span className="is-red">{fmtMoney(lost)}</span> left on the table
              </>
            )}
          </p>
        </div>
      </div>
      <StartingPoint plan={plan} opening={opening} started={started} label={label} onSave={onOpening} />
    </section>
  );
}

const pct = (f: number) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`;
const vars = (o: Record<string, string>) => o as CSSProperties;

/** The Quarterly Bonus as one number: what it's worth, and how far to it. */
function BonusKpi({ plan, qtd }: { plan: CompPlan; qtd: QuarterToDate }) {
  const kicker = plan.quarterly_kicker!;
  const s = quarterlyKickerSummary(plan, qtd);
  if (!s) return null;
  const tiers = [...kicker.tiers].sort((a, b) => a.attainmentPct - b.attainmentPct);
  const name = (t: QuarterlyKickerTier) => tierName(tiers.indexOf(t) + 1);
  const shown = s.tier ?? s.nextTier ?? tiers[0];
  const value = s.tier
    ? fmtMoney(s.bumpValue)
    : isFixedTier(shown)
      ? fmtMoney(shown.amount as number)
      : `+${fmtPctShort(shown.kickerPct)}`;
  const goal = (s.nextTier ?? shown).attainmentPct;
  const note = s.tier
    ? `Locked in${s.nextTier ? `. ${fmt(s.toNextTierArr)} more new ARR reaches the ${name(s.nextTier)}` : ''}`
    : `${fmt(s.toNextTierArr)} more new ARR to unlock it`;
  return (
    <div className={`kpi kpi-bonus${s.tier ? ' is-won' : ''}`}>
      <p className="app-label">{name(shown)}</p>
      <p className="kpi-value">{value}</p>
      <p className="kpi-note">{note}</p>
      <span
        className="kpi-bar"
        role="img"
        aria-label={`${fmtPctShort(Math.round(s.attainmentPct * 10) / 10)} of the bonus target`}
        style={vars({ '--w': pct(goal > 0 ? s.attainmentPct / goal : 0) })}
      />
    </div>
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
