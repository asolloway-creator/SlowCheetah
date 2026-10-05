import type { CSSProperties } from 'react';
import { DEMO_PLAN } from '@/lib/calc';
import { fmt, fmtMoney, fmtPctShort } from '@/lib/format';
import { mapRecord, recordFromPlan } from '@/lib/plan-record/map';
import { readback } from '@/lib/plan-record/copy';
import { OPENING_PTD, OPENING_QTD, SAMPLE } from '@/components/opening';
import { SAMPLE_BONUS_LINE, sampleAt } from '@/components/sampleFigures';
import { showcaseScript } from '@/components/showcase';

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
      <span className="still-slider-chip">
        Bonus line <b>{fmtPctShort(line)}</b>
      </span>
    </div>
  );
}

const MicIcon = () => (
  <svg viewBox="0 0 20 20" fill="none">
    <rect x="7" y="2.5" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/**
 * How you use IOI, in three steps, each with a still of the real screen on
 * the sample plan: say how you're paid (the plan reader), drag before you
 * quote (the card), hold the line (the most you can give and keep the
 * bonus). The landing card above already plays what one discount does; this
 * is how a visitor gets the same on their own plan. Every figure is computed
 * from the sample, and the plan read back is IOI's own readback of it.
 */
export default function HowItWorks() {
  const story = showcaseScript(DEMO_PLAN, SAMPLE, OPENING_PTD, OPENING_QTD);
  const mid = sampleAt(15);
  const held = sampleAt(story?.hold ?? 24);
  const over = sampleAt(story?.ask ?? 25);
  const line = SAMPLE_BONUS_LINE ?? 0;

  // What a rep might say for "What does a deal pay you?", and what IOI reads back.
  const said = `${fmtPctShort(DEMO_PLAN.base_rate)} of first-year value. Setup fees count at ${fmtPctShort(DEMO_PLAN.one_time_weight)}.`;
  const record = recordFromPlan(DEMO_PLAN);
  const groups = readback(record, mapRecord(record));
  const shown = groups.filter((g) => g.title === 'Each deal' || g.title === 'As you sell more');
  const readbackGroups = shown.length ? shown : groups.slice(1, 3);

  return (
    <section className="how" id="how" aria-labelledby="how-h">
      <div className="container">
        <div className="how-head">
          <p className="eyebrow">
            <span className="mark-dot" aria-hidden="true" />
            How it works
          </p>
          <h2 id="how-h">
            Tell it once. <br />
            Use it on every deal.
          </h2>
          <p>
            Say how you&rsquo;re paid, once. From then on, every deal you&rsquo;re about to quote shows what it pays, what it
            costs and where your line is.
          </p>
        </div>

        <div className="beats">
          <article className="beat">
            <div className="beat-copy">
              <p className="beat-label">
                <span className="sq sq-pays" aria-hidden="true" />
                Step 1
              </p>
              <h3>Say how you&rsquo;re paid</h3>
              <p>
                Type it or talk it through, the way you&rsquo;d explain it to a friend: your quota, what a deal pays, what
                changes past quota. IOI reads it back so you can check every rule before it counts.
              </p>
              <dl className="beat-scope">
                <div>
                  <dt>In the numbers</dt>
                  <dd>
                    Quotas in new ARR or units, a percent of the deal or months of MRR, setup fees and hardware,
                    accelerators with one step or several, and Quarterly Bonuses that pay a percent or a fixed amount.
                  </dd>
                </div>
                <div>
                  <dt>Noted, not in the numbers yet</dt>
                  <dd>Caps, clawbacks, SPIFs, draws and multi-year credit.</dd>
                </div>
              </dl>
            </div>
            <div className="beat-stage is-sun" aria-hidden="true">
              <span className="beat-ring" />
              <div className="still-card still-a">
                <p className="still-q">
                  <span className="cap-q-num">2</span>
                  What does a deal pay you?
                </p>
                <div className="still-box">
                  <p className="still-said">{said}</p>
                  <div className="still-box-foot">
                    <span className="mic is-listening">
                      <MicIcon />
                      Listening. Tap to stop
                    </span>
                  </div>
                </div>
              </div>
              <div className="still-card still-b still-readback">
                <p className="still-readback-h">Here&rsquo;s your plan.</p>
                {readbackGroups.map((g) => (
                  <div key={g.title} className="still-group">
                    <p className="cap-group-h">{g.title}</p>
                    {g.lines.map((l) => (
                      <p key={`${l.area}:${l.index}`} className="still-line">
                        {l.text}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="beat">
            <div className="beat-copy">
              <p className="beat-label">
                <span className="sq sq-costs" aria-hidden="true" />
                Step 2
              </p>
              <h3>Drag before you quote</h3>
              <p>
                Every point of discount shows what it costs you, and whether it moves your accelerator or your bonus. At{' '}
                {fmtPctShort(mid.pct)} off, this sample deal costs you{' '}
                <span className="is-red">{fmtMoney(mid.discountsCost)}</span> and the Quarterly Bonus still holds.
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
                Step 3
              </p>
              <h3>Hold the line</h3>
              <p>
                When a discount would cost you a bonus or an accelerator, IOI shows the most you can give and keep it.
                {story && over.bonus && held.bonus && (
                  <>
                    {' '}
                    On this sample deal that&rsquo;s {fmtPctShort(story.hold)}: your prospect still saves{' '}
                    {fmt(held.prospectSaves)} a year, and you keep a{' '}
                    <span className="is-green">{fmt(held.bonus.value)}</span> Quarterly Bonus.
                  </>
                )}
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
                <StillSlider pct={held.pct} line={line} lost={false} />
                <p className="still-sub">
                  This deal&rsquo;s discounts cost you <span className="is-red">{fmtMoney(held.discountsCost)}</span>.
                </p>
                <hr />
                <div className="still-row">
                  <p className="still-label">
                    <span className="sq sq-pays" />
                    Commission on this deal
                  </p>
                  <p className="still-money-md is-green">{fmtMoney(held.commission)}</p>
                </div>
              </div>
              {story && over.bonus && held.bonus && (
                <div className="still-card still-b still-compare">
                  <div className="still-compare-row">
                    <span className="still-compare-left">
                      <span className="still-compare-pct">{fmtPctShort(story.ask)} off</span>
                      <span className="still-compare-what">Quarterly Bonus lost</span>
                    </span>
                    <span className="still-compare-fig is-red">&minus;{fmt(over.bonus.value)}</span>
                  </div>
                  <div className="still-compare-row">
                    <span className="still-compare-left">
                      <span className="still-compare-pct">{fmtPctShort(story.hold)} off</span>
                      <span className="still-compare-what">Quarterly Bonus kept</span>
                    </span>
                    <span className="still-compare-fig is-green">{fmt(held.bonus.value)}</span>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
