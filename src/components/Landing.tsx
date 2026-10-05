'use client';

import Link from 'next/link';
import type { CompPlan, PeriodToDate, QuarterToDate } from '@/lib/calc';
import { standing } from '@/components/opening';
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

/** The landing page's intro, beside the live result card. `account`: this
 *  browser has signed in before, so the ask is to sign back in (lib/demo-flag.ts). */
export function LandingHero({ account = false }: { account?: boolean }) {
  return (
    <div className="hero">
      <p className="hero-chip">
        <span className="mark-dot" aria-hidden="true" />
        {account ? 'Welcome back' : 'Pricing and deal intelligence for sales reps'}
      </p>
      <h1 className="hero-h">
        Know what a deal pays. <br />
        <span className="hero-hl">And what it costs.</span>
      </h1>
      <p className="hero-lede">
        {account ? (
          <>
            Your plan, your deals and where you stand are in your account. <b>Sign in to pick up where you left off.</b>
          </>
        ) : (
          <>
            Your commission, your accelerator and your bonus, <b>before you make the offer</b>. Not after it lands in your
            check.
          </>
        )}
      </p>
      <div className="hero-ctas">
        <Link className="btn btn-primary btn-lg" href={account ? '/login' : '/?plan=1'} scroll={false}>
          {account ? 'Sign in' : 'Put your plan in'}
          <span className="btn-arrow">
            <Arrow />
          </span>
        </Link>
        <button type="button" className="hero-try" onClick={watchSample}>
          Or watch a sample deal
          <Arrow />
        </button>
      </div>
      <p className="hero-note">
        {account ? 'A link or a code by email, on any device. No password.' : 'Free. No sign-up. Your plan stays anonymous.'}
      </p>
    </div>
  );
}

/**
 * The returning rep's intro, in the landing page's voice: a welcome, then the
 * one thing they can win or lose right now as the headline (standing() in
 * opening.ts), and where they stand underneath. The deal page below it is
 * their tool; this is the greeting.
 */
export function WelcomeBack({
  plan,
  ptd,
  qtd,
  label,
  planSaved,
}: {
  plan: CompPlan;
  ptd: PeriodToDate;
  qtd: QuarterToDate | null;
  label: string;
  /** They just put the plan in, so it's not yet a "back". */
  planSaved: boolean;
}) {
  const s = standing(plan, ptd, qtd, label);
  return (
    <div className="hero is-standing">
      <p className="hero-chip">
        <span className="mark-dot" aria-hidden="true" />
        {planSaved ? 'Your plan is in' : `Welcome back · ${label}`}
      </p>
      <h1 className="hero-h">
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
      <p className="hero-lede">{s.lede}</p>
      <div className="hero-ctas">
        <Link className="btn btn-primary btn-lg" href="/quota">
          See where you stand
          <span className="btn-arrow">
            <Arrow />
          </span>
        </Link>
        <Link className="hero-try" href="/plan">
          Edit your plan
          <Arrow />
        </Link>
      </div>
      <p className="hero-note">{s.note}</p>
    </div>
  );
}

/** The page's closing ask. */
export function ClosingCta({ account = false }: { account?: boolean }) {
  return (
    <section className="closing" aria-labelledby="closing-h">
      <div className="container">
        <div className="closing-panel">
          <span className="closing-ring" aria-hidden="true" />
          <div className="closing-copy">
            <h2 id="closing-h">Stop finding out on payday.</h2>
            <p>
              {account
                ? 'Sample numbers are a demo. Your plan is in your account: sign in and every figure is yours again.'
                : 'Sample numbers are a demo. Put in your own comp plan and every figure becomes yours.'}
            </p>
            <div className="hero-ctas">
              {account ? (
                <Link className="btn btn-primary btn-lg" href="/login">
                  Sign in
                  <span className="btn-arrow">
                    <Arrow />
                  </span>
                </Link>
              ) : (
                <>
                  <Link className="btn btn-primary btn-lg" href="/?plan=1" scroll={false}>
                    Put your plan in
                    <span className="btn-arrow">
                      <Arrow />
                    </span>
                  </Link>
                  <Link className="btn btn-line btn-lg" href="/login">
                    Sign in
                  </Link>
                </>
              )}
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
