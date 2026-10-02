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
        <span className="mark-dot" aria-hidden="true" />Pricing and deal intelligence for sales reps
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
        <Link className="btn btn-primary btn-lg" href="/?plan=1" scroll={false}>
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
      <p className="hero-note">Free. No sign-up. Your plan stays anonymous.</p>
    </div>
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
              <Link className="btn btn-primary btn-lg" href="/?plan=1" scroll={false}>
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
