'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import {
  isFixedTier,
  needsQuarterArr,
  periodLabel,
  periodSummary,
  quarterlyKickerSummary,
  type CompPlan,
  type Opening,
  type OpeningInput,
  type PeriodToDate,
  type QuarterToDate,
  type QuarterlyKickerTier,
} from '@/lib/calc';
import { tierName } from '@/components/opening';
import type { DealRow } from '@/lib/queries';
import { fmt, fmtCredit, fmtMoney, fmtPctShort, fmtRateShort, fmtSigned, periodNoun } from '@/lib/format';
import QuotaLine from '@/components/QuotaLine';
import Ledger, { type LedgerRow } from '@/components/Ledger';
import OpeningFields from '@/components/OpeningFields';

/**
 * Where you stand: one narrative — a figure, the line, one sentence, a
 * ledger. `ptd` already includes the rep's starting point (`opening`, what
 * they'd booked before IOI); it gets its own ledger line, and it can be
 * added or changed here.
 */
export default function QuotaView({
  plan,
  ptd,
  deals,
  opening = null,
  onOpening,
  qtd = null,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  deals: DealRow[];
  /** The calendar quarter so far, for a plan with a quarterly bonus. */
  qtd?: QuarterToDate | null;
  /** The starting point for this period, when there is one. */
  opening?: Opening | null;
  onOpening?: (o: OpeningInput) => Promise<{ error?: string }>;
}) {
  const s = periodSummary(plan, ptd);
  const label = periodLabel(plan.period);
  const noun = periodNoun(plan);
  const retro = plan.accelerator_style === 'retro_bump';
  const hasAccel = plan.accelerator_style !== 'none';
  const started = opening !== null && (opening.credit > 0 || (opening.quarterArr ?? 0) > 0);
  const empty = deals.length === 0 && !(opening && opening.credit > 0);

  const units = deals.reduce((n, d) => n + d.units, 0);
  const arr = deals.reduce((n, d) => n + d.arr, 0);
  const lost = deals.reduce((n, d) => n + d.money_left_on_table, 0);
  const pct = plan.quota > 0 ? Math.round((ptd.creditBooked / plan.quota) * 100) : 0;

  const sentence = hasAccel
    ? s.accelerated
      ? retro
        ? `You crossed your accelerator. Every deal this ${noun} pays ${fmtPctShort(plan.accelerator_rate)} more. That’s ${fmtMoney(s.acceleratorValue)} so far.`
        : `You’re past your accelerator. Every deal from here earns ${fmtRateShort(plan, plan.accelerator_rate)}.`
      : retro
        ? `Hold the line on the next ${fmtCredit(plan, s.toAccelerator)} and you unlock ${fmtSigned(s.acceleratorValue)} on the deals you’ve already closed.`
        : `${fmtCredit(plan, plan.accelerator_threshold)} land and every deal from there earns ${fmtRateShort(plan, plan.accelerator_rate)}. ${fmtCredit(plan, s.toAccelerator)} to go.`
    : s.attained
      ? 'Quota made. Same rate on every deal.'
      : `${fmtCredit(plan, s.toQuota)} to quota. Same rate on every deal.`;

  const rows: LedgerRow[] = [
    ...(opening && opening.credit > 0
      ? [{ label: 'Booked before IOI', value: fmtCredit(plan, opening.credit), suffix: '· your starting point' }]
      : []),
    {
      label: 'Deals booked',
      value: `${deals.length} deal${deals.length === 1 ? '' : 's'}`,
      suffix: `· ${units} unit${units === 1 ? '' : 's'}`,
    },
    { label: 'New ARR', value: fmtMoney(arr) },
    {
      label: 'Commission so far',
      value: fmtMoney(s.payout),
      // A starting point in ARR is counted at the base rate (IOI never saw
      // those deals); one in units carries no dollars at all. Say which.
      suffix:
        opening && opening.credit > 0
          ? plan.quota_basis === 'arr'
            ? '· what you’d booked before IOI counted at your base rate'
            : '· on deals booked in IOI'
          : s.accelerated && retro
            ? `· includes the +${fmtPctShort(plan.accelerator_rate)} bump`
            : plan.accelerator_style === 'rate_switch' && s.accelerated
              ? '· as booked'
              : `· at ${fmtRateShort(plan, plan.base_rate)}`,
    },
    // Each deal's own residual, locked in at whatever it cost when THAT
    // deal was booked — a discount given before you crossed the
    // accelerator doesn't get rewritten once later deals cross it, so
    // this can (and usually does) stay well above zero even once
    // s.accelerated is true. The suffix exists so that isn't read as a
    // contradiction — without it "past your accelerator" right above a
    // nonzero red figure reads as the two disagreeing with each other.
    {
      label: 'Left on the table',
      value: fmtMoney(lost),
      suffix: lost > 0 ? `· across every discount given this ${noun}` : undefined,
      tone: lost > 0 ? 'red' : 'dim',
    },
  ];

  return (
    <div className="quota">
      <h1 className="page-title">Where you stand in {label}</h1>
      <p className={`quota-figure${s.accelerated ? ' is-green' : ''}`}>{fmtCredit(plan, ptd.creditBooked)}</p>
      <p className="quota-caption">
        {empty
          ? `Nothing booked in ${label} yet.`
          : plan.quota_basis === 'arr'
            ? `booked toward a ${fmtMoney(plan.quota)} quota, ${pct}% there.`
            : `of ${fmtCredit(plan, plan.quota)}, ${pct}% there.`}
      </p>

      <QuotaLine mode="quarter" plan={plan} ptd={ptd} />

      {empty ? (
        <p className="quota-sentence">
          <Link className="btn-text" href="/">
            Enter a deal &rarr;
          </Link>
        </p>
      ) : (
        <>
          <p className="quota-sentence">{sentence}</p>
          <h2 className="section-h">This {noun} so far</h2>
          <Ledger rows={rows} />
        </>
      )}

      {plan.quarterly_kicker && qtd && <BonusStanding plan={plan} qtd={qtd} />}

      {onOpening && <StartingPoint plan={plan} opening={opening} started={started} label={label} onSave={onOpening} />}
    </div>
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

  if (!open) {
    return (
      <p className="quota-start">
        {started ? 'Includes what you’d booked before IOI. ' : `Started using IOI partway through ${label}? `}
        <button type="button" className="btn-text" onClick={() => setOpen(true)}>
          {started ? 'Change it' : 'Add what you’d already booked'}
        </button>
      </p>
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
    <div className="quota-start-edit">
      <h2 className="section-h">Where you started {label}</h2>
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
