'use client';

import { useState, type CSSProperties } from 'react';
import type { DealRow } from '@/lib/queries';
import {
  isFixedTier,
  needsQuarterArr,
  openingAnswered,
  periodLabel,
  periodOf,
  periodSummary,
  quarterlyKickerSummary,
  stepRatePct,
  type Calendar,
  type CompPlan,
  type Opening,
  type OpeningInput,
  type PeriodToDate,
  type QuarterToDate,
  type QuarterlyKickerTier,
} from '@/lib/calc';
import { standing, tierName } from '@/components/opening';
import { fmt, fmtCredit, fmtMoney, fmtPctShort, fmtRatePct, fmtRateShort, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import MonthRecap from '@/components/MonthRecap';
import { earnedNow, lostNow, rateLift, type Targets } from '@/components/discounts';
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
  basePlan,
  onRate,
  calendar,
  targets,
}: {
  /** The plan as it pays this period (planForPeriod): the numbers here. */
  plan: CompPlan;
  /** The plan as entered, before this period's rate adjustment. */
  basePlan: CompPlan;
  onRate: (rate: number | null) => Promise<{ error?: string }>;
  calendar: Calendar;
  /** The rep's own discount targets, for the recap. */
  targets?: Targets;
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
  const answered = openingAnswered(opening);
  const now = deals.filter((d) => periodOf(plan.period, d.created_at) === label);
  const monthName = plan.period === 'month' ? label.split(' ')[0] : label;
  // At the rate the period actually pays (past a retro accelerator, every
  // deal booked this period has moved up with it).
  const lift = rateLift(plan, ptd);
  const paid = now.reduce((n, d) => n + earnedNow(plan, d, lift), 0);
  const lost = now.reduce((n, d) => {
    const l = lostNow(plan, d, lift);
    return n + l.software + l.services + l.hardware;
  }, 0);
  const keptShare = paid + lost > 0 ? paid / (paid + lost) : 1;

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

      <MonthRecap plan={plan} deals={deals} today={calendar.today} periodStart={calendar.periodStart} targets={targets} />

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
          <QuotaNote plan={plan} ptd={ptd} deals={now} daysLeft={calendar.daysLeft} monthName={monthName} />
        </div>
        {plan.quarterly_kicker && qtd && <BonusKpi plan={plan} qtd={qtd} quarterDaysLeft={calendar.quarterDaysLeft} />}
        {/* What the month paid and what its discounts gave away, side by
            side at the same weight: the second is the one to change. */}
        <div className="kpi kpi-money">
          <p className="app-label">Commission this {noun}</p>
          <div className="kpi-split">
            <div>
              <p className="kpi-sub">Earned</p>
              <p className="kpi-value is-earned">{fmtMoney(paid)}</p>
            </div>
            <div>
              <p className="kpi-sub">Left on the table</p>
              <p className={`kpi-value${lost >= 0.005 ? ' is-lost' : ''}`}>{fmtMoney(lost)}</p>
            </div>
          </div>
          <span
            className="kpi-split-bar"
            role="img"
            aria-label={`Kept ${Math.round(keptShare * 100)}% of what these deals would have paid at full price`}
            style={vars({ '--w': pct(keptShare) })}
          />
          <p className="kpi-note">
            {now.length === 0
              ? `No deals closed this ${noun} yet.`
              : `${now.length} deal${now.length === 1 ? '' : 's'} · you kept ${Math.round(keptShare * 100)}% of what full price would have paid`}
            {lift > 1 && now.length > 0 && <> · at {fmtRatePct(plan.base_rate * lift)} now that you&rsquo;ve crossed</>}
          </p>
        </div>
      </div>
      <div className="ov-meta">
        <StartingPoint
          plan={plan}
          opening={opening}
          answered={answered}
          compact={now.length > 0}
          label={monthName}
          onSave={onOpening}
        />
        {basePlan.commission_style === 'percent' && <RateThisPeriod plan={plan} basePlan={basePlan} label={monthName} onSave={onRate} />}
      </div>
    </section>
  );
}

const pct = (f: number) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`;
const vars = (o: Record<string, string>) => o as CSSProperties;

/**
 * Under the quota line, what the next line is worth and whether it's in
 * reach: on a retro plan, the dollars crossing it adds to deals already
 * booked; then the days left and, at the rep's own average deal, how many
 * more deals it takes. Past the last step, the rate every deal pays now.
 */
function QuotaNote({
  plan,
  ptd,
  deals,
  daysLeft,
  monthName,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  deals: DealRow[];
  daysLeft: number;
  monthName: string;
}) {
  if (plan.accelerator_style === 'none') return null;
  const s = periodSummary(plan, ptd);
  const noun = periodNoun(plan);
  const lines: string[] = [];
  if (s.next) {
    if (plan.accelerator_style === 'retro_bump' && s.acceleratorValue > 0 && deals.length > 0) {
      lines.push(
        `Cross it and the ${deals.length === 1 ? 'deal' : `${deals.length} deals`} you’ve booked this ${noun} pay ${fmtMoney(s.acceleratorValue)} more.`,
      );
    } else if (plan.commission_style === 'percent') {
      lines.push(`Past it, every deal pays ${fmtRatePct(stepRatePct(plan, s.next))}.`);
    }
    const days = daysLeft <= 1 ? `Last day of ${monthName}` : `${daysLeft} days left in ${monthName}`;
    const avg = deals.length ? deals.reduce((n, d) => n + d.quota_credit, 0) / deals.length : 0;
    if (plan.quota_basis === 'units') lines.push(`${days} · ${fmtCredit(plan, s.toAccelerator)} to go.`);
    else if (avg > 0) {
      const k = Math.max(1, Math.ceil(s.toAccelerator / avg - 1e-9));
      lines.push(`${days} · about ${k} more deal${k === 1 ? '' : 's'} at your average of ${fmtMoney(avg)}.`);
    } else lines.push(`${days}.`);
  } else if (s.step) {
    lines.push(
      plan.commission_style === 'percent'
        ? `Every deal this ${noun} pays ${fmtRatePct(stepRatePct(plan, s.step))}.`
        : `Past your last accelerator: every deal this ${noun} pays ${fmtRateShort(plan, s.step.rate)}.`,
    );
  }
  if (!lines.length) return null;
  return (
    <p className="kpi-note kpi-quota-note">
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </p>
  );
}

/** The Quarterly Bonus as one number: what it's worth, how far to it, and
 *  the pace that gets there by the end of the quarter. */
function BonusKpi({ plan, qtd, quarterDaysLeft }: { plan: CompPlan; qtd: QuarterToDate; quarterDaysLeft: number }) {
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
  // The pace to the next tier by quarter end, against a monthly quota when
  // the plan has one in the same currency.
  let pace: string | null = null;
  if (s.nextTier && s.toNextTierArr > 0 && quarterDaysLeft > 0) {
    const months = Math.max(quarterDaysLeft / 30.44, 1 / 30.44);
    const perMonth = s.toNextTierArr / months;
    const ofQuota =
      plan.period === 'month' && plan.quota_basis === 'arr' && plan.quota > 0 ? ` (${Math.round((perMonth / plan.quota) * 100)}% of your monthly quota)` : '';
    pace =
      quarterDaysLeft <= 31
        ? `${quarterDaysLeft} day${quarterDaysLeft === 1 ? '' : 's'} left in the quarter.`
        : `About ${fmt(perMonth)} a month to get there by quarter end${ofQuota}.`;
  }
  return (
    <div className={`kpi kpi-bonus${s.tier ? ' is-won' : ''}`}>
      <p className="app-label">{name(shown)}</p>
      <p className="kpi-value">{value}</p>
      <p className="kpi-note">{note}</p>
      {pace && <p className="kpi-note kpi-pace">{pace}</p>}
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
  answered,
  compact,
  label,
  onSave,
}: {
  plan: CompPlan;
  opening: Opening | null;
  answered: boolean;
  /** Deals are in for this period already: ask in a line, not a card. */
  compact: boolean;
  label: string;
  onSave: (o: OpeningInput) => Promise<{ error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [credit, setCredit] = useState(opening?.credit ?? 0);
  const [quarterArr, setQuarterArr] = useState(opening?.quarterArr ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Nothing to add" is an answer too: the question goes away.
  async function nothing() {
    setBusy(true);
    setError(null);
    let res: { error?: string };
    try {
      res = await onSave({ credit: 0, quarterArr: needsQuarterArr(plan) ? 0 : null });
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setBusy(false);
    if (res.error) setError(res.error);
  }

  if (!open && answered) {
    const had = (opening?.credit ?? 0) > 0;
    return (
      <p className="quota-start">
        {had ? (
          <>Includes {fmtCredit(plan, opening?.credit ?? 0)} you&rsquo;d booked before IOI. </>
        ) : (
          <>Nothing booked in {label} before IOI. </>
        )}
        <button type="button" className="btn-text" onClick={() => setOpen(true)}>
          Change it
        </button>
      </p>
    );
  }
  if (!open && compact) {
    return (
      <p className="quota-start">
        Booked anything in {label} before IOI?{' '}
        <button type="button" className="btn-text" onClick={() => setOpen(true)}>
          Add it
        </button>{' '}
        ·{' '}
        <button type="button" className="btn-text" disabled={busy} onClick={() => void nothing()}>
          Nothing to add
        </button>
        {error && <span className="is-red"> {error}</span>}
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
          {error && <p className="is-red">{error}</p>}
        </div>
        <div className="start-card-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
            Add what you&rsquo;ve booked
          </button>
          <button type="button" className="btn-text" disabled={busy} onClick={() => void nothing()}>
            Nothing to add
          </button>
        </div>
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
    <div className={answered ? 'quota-start-edit' : 'start-card is-open'}>
      <h2 className={answered ? 'section-h' : 'start-card-h'}>What you&rsquo;d booked in {label} before IOI</h2>
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

/**
 * The rate on the rep's latest commission statement, this period: the plan's
 * own rate moved by whatever the plan document can't know ahead (a referral
 * or MBO adjustment). Every number on the page uses it.
 */
function RateThisPeriod({
  plan,
  basePlan,
  label,
  onSave,
}: {
  plan: CompPlan;
  basePlan: CompPlan;
  label: string;
  onSave: (rate: number | null) => Promise<{ error?: string }>;
}) {
  const adjusted = Math.abs(plan.base_rate - basePlan.base_rate) > 1e-9;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(rate: number | null) {
    setBusy(true);
    setError(null);
    let res: { error?: string };
    try {
      res = await onSave(rate);
    } catch {
      res = { error: 'Could not reach the server. Check your connection and try again.' };
    }
    setBusy(false);
    if (res.error) return setError(res.error);
    setOpen(false);
  }

  if (!open) {
    return (
      <p className="quota-start ov-rate">
        Your rate in {label}: <b>{fmtRatePct(plan.base_rate)}</b>
        {adjusted && <> (plan {fmtRatePct(basePlan.base_rate)})</>}.{' '}
        <button
          type="button"
          className="btn-text"
          onClick={() => {
            setDraft(String(parseFloat(plan.base_rate.toFixed(2))));
            setOpen(true);
          }}
        >
          Change it
        </button>
      </p>
    );
  }
  const n = parseFloat(draft.replace(/[^0-9.]/g, ''));
  return (
    <form
      className="ov-rate-edit"
      onSubmit={(e) => {
        e.preventDefault();
        if (Number.isFinite(n)) void save(Math.abs(n - basePlan.base_rate) < 1e-9 ? null : n);
      }}
    >
      <label className="field">
        <span className="field-label">Your rate in {label}</span>
        <span className="field-box has-suffix ov-rate-box">
          <input className="field-input" inputMode="decimal" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
          <span className="field-suffix">%</span>
        </span>
      </label>
      <p className="field-note">
        Before any accelerator, as your latest commission statement shows it. Your plan says {fmtRatePct(basePlan.base_rate)}; a
        monthly adjustment like a referral bonus moves it.
      </p>
      {error && (
        <p className="cap-msg is-error" role="alert">
          {error}
        </p>
      )}
      <div className="cap-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || !Number.isFinite(n)}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {adjusted && (
          <button type="button" className="btn-text" disabled={busy} onClick={() => void save(null)}>
            Use the plan&rsquo;s {fmtRatePct(basePlan.base_rate)}
          </button>
        )}
        <button type="button" className="btn-text" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
