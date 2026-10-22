'use client';

import Link from 'next/link';
import Sculpture from '@/components/Sculpture';
import { SHOWCASE_EVENT } from '@/components/useShowcase';

const Arrow = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Brings the sample deal into view and plays its story from the start. */
function watchSample() {
  window.dispatchEvent(new Event(SHOWCASE_EVENT));
}

/** The landing page's intro, beside the live result card. */
export function LandingHero() {
  return (
    <div className="hero">
      <p className="hero-chip">
        <span className="mark-dot" aria-hidden="true" />
        Pricing and deal intelligence for sales reps
      </p>
      <h1 className="hero-h">
        Know what a deal pays. <br />
        <span className="hero-hl">And what it costs.</span>
      </h1>
      <p className="hero-lede">
        Your commission, your accelerator and your bonus, <b>before you make the offer</b>. Not after it lands in your
        check.
      </p>
      <div className="hero-ctas">
        <Link className="btn btn-primary btn-lg" href="/signup">
          Put your plan in
          <span className="btn-arrow">
            <Arrow />
          </span>
        </Link>
        <button type="button" className="hero-try" onClick={watchSample}>
          Or watch a sample deal
          <Arrow />
        </button>
      </div>
      <p className="hero-note">Free. No password, just your email. Your plan stays anonymous.</p>
    </div>
  );
}

/**
 * What the name means, and the bet the product is built on: incentives buy
 * a good week; knowing what a deal pays, in the moment, changes how it's
 * priced. Two short columns put the two side by side.
 */
export function WhyIoi() {
  const incentive = [
    'A SPIF moves the number for a week, then it’s gone.',
    'A contest pays whoever was already closing.',
    'An accelerator only pays if you know where it starts.',
  ];
  const information = [
    'What this deal pays you, before you quote it.',
    'What each point of discount costs you.',
    'Where your accelerator and Quarterly Bonus lines are, and how to keep them.',
  ];
  return (
    <section className="why" aria-labelledby="why-h">
      <div className="container">
        <div className="why-panel">
          <div className="why-copy">
            <p className="eyebrow">
              <span className="mark-dot" aria-hidden="true" />
              Why IOI
            </p>
            <h2 id="why-h">
              <span className="why-hl">Information</span> over incentive.
            </h2>
            <p>
              Contests and SPIFs buy a good week. They don&rsquo;t change how a deal gets priced. What changes it is
              knowing what a discount does to your commission, your accelerator and your Quarterly Bonus, at the
              moment you&rsquo;re about to give it. IOI is built on that.
            </p>
          </div>
          <div className="why-compare">
            <div className="why-col is-incentive">
              <p className="why-col-h">Incentive</p>
              <ul>
                {incentive.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="why-col is-information">
              <p className="why-col-h">Information</p>
              <ul>
                {information.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The page's closing ask. */
export function ClosingCta() {
  return (
    <section className="closing" aria-labelledby="closing-h">
      <div className="container">
        <div className="closing-panel">
          <span className="closing-ring" aria-hidden="true" />
          <div className="closing-copy">
            <h2 id="closing-h">Stop finding out on payday.</h2>
            <p>Sample numbers are a demo. Put in your own comp plan and every figure becomes yours.</p>
            <div className="hero-ctas">
              <Link className="btn btn-primary btn-lg" href="/signup">
                Put your plan in
                <span className="btn-arrow">
                  <Arrow />
                </span>
              </Link>
              <Link className="btn btn-line btn-lg" href="/login">
                Sign in
              </Link>
            </div>
          </div>
          <div className="closing-art" aria-hidden="true">
            <Sculpture kind="chart" id="sc-close-a" palette="light" className="closing-sculpture is-a" />
            <Sculpture kind="cube-sm" id="sc-close-b" palette="light" className="closing-sculpture is-b" />
          </div>
        </div>
      </div>
    </section>
  );
}
