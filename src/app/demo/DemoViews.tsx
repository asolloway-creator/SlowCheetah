'use client';

import { useEffect } from 'react';
import { DEMO_PLAN } from '@/lib/calc';
import { Shell } from '@/app/AccountViews';
import DealStage from '@/components/DealStage';
import HowItWorks from '@/components/HowItWorks';
import { ClosingCta, LandingHero } from '@/components/Landing';
import { OPENING_PTD, OPENING_QTD, SAMPLE } from '@/components/opening';

/** Never called: the sample card can't book a deal. */
const noSave = async () => ({});

/**
 * Signed out, everyone gets the same home page: the pitch beside the sample
 * card playing its story, How it works, and the closing ask. A plan of your own
 * lives in an account ("Put your plan in" creates one); nothing is kept in the
 * browser.
 */
export function DemoDeal() {
  // Plans and flags an earlier version kept in this browser are no longer read.
  useEffect(() => {
    try {
      localStorage.removeItem('ioi-demo-v3');
      localStorage.removeItem('ioi-account');
    } catch {}
  }, []);

  return (
    <Shell current="/" email={null} width="full">
      <DealStage
        plan={DEMO_PLAN}
        ptd={OPENING_PTD}
        qtd={OPENING_QTD}
        demo
        onSave={noSave}
        initialDeal={SAMPLE}
        intro={<LandingHero />}
      />
      <HowItWorks />
      <ClosingCta />
    </Shell>
  );
}
