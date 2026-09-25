import type { CSSProperties } from 'react';
import { DEMO_PLAN } from '@/lib/calc';
import { fmtCredit, fmtMoney, fmtPctShort, fmtRateShort } from '@/lib/format';
import { OPENING_PTD } from '@/components/opening';
import { SAMPLE_BONUS_LINE, sampleAt } from '@/components/sampleFigures';

const vars = (o: Record<string, string>) => o as CSSProperties;

/** A still frame of the result card's slider: fill to `pct`, the bonus line at `line`. */
function StillSlider({ pct, line, lost }: { pct: number; line: number; lost: boolean }) {
  return (
    <div className={`still-slider${lost ? ' is-lost' : ''}`} style={vars({ '--pct': String(pct), '--kx': String(line) })}>
      <span className="still-slider-bubble">{fmtPctShort(pct)}</span>
      <span className="still-slider-track">
        <span className="still-slider-zone" />
        <span className="still-slider-fill" />
      </span>
      <span className="still-slider-line" />
      <span className="still-slider-thumb" />
      <span className="still-slider-chip">{fmtPctShort(line)}</span>
    </div>
  );
}

const StepIcon = () => (
  <span className="dc-icon" aria-hidden="true">
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M3 15.5h3.2v-4H9.4v-3.5h3.2V4.5H17" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

/**
 * Three beats, each illustrated with a still of the real card on the sample
 * deal: what it pays, what a discount costs, what it puts at stake.
 */
export default function HowItWorks() {
  const rest = sampleAt(0);
  const mid = sampleAt(15);
  const over = sampleAt(25);
  const line = SAMPLE_BONUS_LINE ?? 0;
  const accelRate = fmtRateShort(DEMO_PLAN, DEMO_PLAN.accelerator_rate);
  const threshold = fmtCredit(DEMO_PLAN, DEMO_PLAN.accelerator_threshold);
  const booked = OPENING_PTD.creditBooked;
  const adds = rest.creditAfter - booked;
  const kicker = DEMO_PLAN.quarterly_kicker!;
  const bonusLine = fmtPctShort(Math.min(...kicker.tiers.map((t) => t.attainmentPct)));

  return (
    <section className="how" id="how" aria-labelledby="how-h">
      <div className="container">
        <div className="how-head">
          <p className="eyebrow">
            <span className="mark-dot" aria-hidden="true" />
            How it works
          </p>
          <h2 id="how-h">No tool tells you what a deal costs. IOI does.</h2>
          <p>Every offer moves three numbers. IOI shows all three while the offer is still yours to change.</p>
        </div>

        <div className="beats">
          <article className="beat">
            <div className="beat-copy">
              <p className="beat-label">
                <span className="sq sq-pays" aria-hidden="true" />
                Pays
              </p>
              <h3>What the deal pays you</h3>
              <p>
                Your commission at the rate you&rsquo;ll actually earn. The sample deal lands the month at {threshold}, so
                it crosses the accelerator and pays {rest.rate} on <b>{fmtMoney(rest.commissionable)}</b> commissionable:{' '}
                <span className="is-green">{fmtMoney(rest.commission)}</span>.
              </p>
            </div>
            <div className="beat-stage is-sun" aria-hidden="true">
              <span className="beat-ring" />
              <div className="still-card still-a">
                <p className="still-label">
                  <span className="sq sq-pays" />
                  Commission on this deal
                </p>
                <p className="still-money is-green">{fmtMoney(rest.commission)}</p>
                <p className="still-sub">
                  {fmtMoney(rest.commissionable)} commissionable · {rest.rate}, accelerated
                </p>
                <hr />
                <div className="dc-sentence has-icon">
                  <StepIcon />
                  <p>
                    <b>This deal triggers your accelerator.</b> Every deal after this one earns {accelRate}.
                  </p>
                </div>
              </div>
              <div className="still-card still-b">
                <div className="still-row">
                  <p className="still-label">Month to date</p>
                  <p className="still-note">
                    <b>{Math.round(rest.creditAfter)}</b> of {threshold}
                  </p>
                </div>
                <div className="still-units" style={vars({ '--booked': `${booked}fr`, '--adds': `${adds}fr` })}>
                  <span className="is-booked" />
                  <span className="is-deal" />
                </div>
                <p className="still-note">
                  {booked} booked + {adds} from this deal. <b>{accelRate} from here.</b>
                </p>
              </div>
            </div>
          </article>

          <article className="beat">
            <div className="beat-copy">
              <p className="beat-label">
                <span className="sq sq-costs" aria-hidden="true" />
                Costs
              </p>
              <h3>What each point of discount costs you</h3>
              <p>
                Drag the discount and watch it come out of your side too. At {fmtPctShort(mid.pct)} off, this
                deal&rsquo;s discounts cost you <span className="is-red">{fmtMoney(mid.discountsCost)}</span> and the
                deal pays <span className="is-green">{fmtMoney(mid.commission)}</span>. The Quarterly Bonus still holds.
              </p>
            </div>
            <div className="beat-stage is-butter" aria-hidden="true">
              <span className="beat-ring" />
              <div className="still-card still-a">
                <div className="still-row">
                  <p className="still-label">
                    <span className="sq sq-costs" />
                    Discount on the subscription
                  </p>
                </div>
                <StillSlider pct={mid.pct} line={line} lost={false} />
                <p className="still-sub">
                  This deal&rsquo;s discounts cost you <span className="is-red">{fmtMoney(mid.discountsCost)}</span>.
                </p>
                <hr />
                <div className="still-row">
                  <p className="still-label">
                    <span className="sq sq-pays" />
                    Commission on this deal
                  </p>
                  <p className="still-money-md is-green">{fmtMoney(mid.commission)}</p>
                </div>
              </div>
              {mid.bonus && (
                <div className="still-card still-b kicker-outcome is-green">
                  <p className="kicker-outcome-label">{mid.bonus.label}:</p>
                  <p className="kicker-outcome-figure">{fmtMoney(mid.bonus.value)}</p>
                </div>
              )}
            </div>
          </article>

          <article className="beat">
            <div className="beat-copy">
              <p className="beat-label">
                <span className="sq sq-stake" aria-hidden="true" />
                Puts at stake
              </p>
              <h3>What it puts at stake</h3>
              <p>
                Some discounts cost more than the deal. At {fmtPctShort(over.pct)} off, the quarter drops below{' '}
                {bonusLine} SaaS attainment and the Quarterly Bonus is gone:{' '}
                <span className="is-red">{over.bonus ? fmtMoney(over.bonus.value) : ''}</span>, on top of{' '}
                <span className="is-red">{fmtMoney(over.discountsCost)}</span> off this deal.
              </p>
            </div>
            <div className="beat-stage is-ink" aria-hidden="true">
              <span className="beat-ring" />
              <div className="still-card still-a">
                <div className="still-row">
                  <p className="still-label">
                    <span className="sq sq-costs" />
                    Discount on the subscription
                  </p>
                </div>
                <StillSlider pct={over.pct} line={line} lost />
                <p className="still-sub">
                  This deal&rsquo;s discounts cost you <span className="is-red">{fmtMoney(over.discountsCost)}</span>.
                </p>
                <hr />
                <div className="still-row">
                  <p className="still-label">
                    <span className="sq sq-pays" />
                    Commission on this deal
                  </p>
                  <p className="still-money-md is-green">{fmtMoney(over.commission)}</p>
                </div>
              </div>
              {over.bonus && over.bonus.tone === 'red' && (
                <div className="still-card still-b kicker-outcome is-red">
                  <p className="kicker-outcome-label">{over.bonus.label}:</p>
                  <p className="kicker-outcome-figure">{fmtMoney(over.bonus.value)}</p>
                  <p className="kicker-outcome-sentence">{over.bonus.sentence}</p>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
