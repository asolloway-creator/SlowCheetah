import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEMO_PLAN } from '@/lib/calc';
import { fmtMoney } from '@/lib/format';
import { OPENING_PTD, OPENING_QTD, SAMPLE, crossEffect, dealSummary, kickerGroundingDetail, kickerOutcomeCopy, outcome } from '@/components/opening';

/**
 * The card LinkedIn/iMessage/Slack unfurl, rendered from the same engine and
 * the same numbers as the live KickerOutcome card (KickerOutcome.tsx) — not
 * a bespoke mockup. SAMPLE at rest (its default 0% subscription discount)
 * is DEMO_PLAN's own tuned "unlocks the Quarterly Bonus at a clean
 * $10,780.92" scenario — see the sizing comment on DEMO_PLAN in calc.ts.
 * Read-only: SAMPLE/OPENING_PTD/OPENING_QTD also seed the live app's
 * pre-hydration frame, so nothing here may redefine them.
 */

export const alt =
  'IOI — See the whole deal before the offer is made. This deal unlocks your Quarterly Bonus — $10,780.92.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const C = {
  paper: '#F5F2EB',
  ink: '#17150F',
  grey1: '#5F5A50',
  green: '#0E7A3E',
  greenTint: 'rgba(14,122,62,.14)',
};

const font = (file: string) => readFile(join(process.cwd(), 'src/app/_fonts', file));

export default async function Image() {
  const [regular, medium, semibold] = await Promise.all([
    font('Inter-Regular.ttf'),
    font('Inter-Medium.ttf'),
    font('Inter-SemiBold.ttf'),
  ]);

  const o = outcome(DEMO_PLAN, SAMPLE, OPENING_PTD);
  const x = crossEffect(DEMO_PLAN, o, OPENING_QTD);
  const copy = kickerOutcomeCopy(DEMO_PLAN, x, OPENING_QTD);
  const grounding = kickerGroundingDetail(DEMO_PLAN, OPENING_QTD);
  // SAMPLE at rest is known to unlock the tier (see the file comment above).
  if (!copy || copy.tone !== 'green' || !grounding) throw new Error('opengraph-image: expected SAMPLE to unlock a kicker tier');

  const W = 1072;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: C.paper,
          color: C.ink,
          display: 'flex',
          flexDirection: 'column',
          padding: 64,
          fontFamily: 'Inter',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', height: 46 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 0.8 }}>IOI</div>
            {/* Satori (this renderer) drops whitespace at span/text
                boundaries, unlike a browser — the live Wordmark's
                per-letter accent isn't reproducible here, so this stays
                plain text rather than silently losing its spaces. */}
            <div style={{ display: 'flex', fontSize: 15, fontWeight: 400, color: C.grey1 }}>Information over incentive</div>
          </div>
          <div style={{ fontSize: 20, color: C.grey1 }}>tryioi.com</div>
        </div>

        <div style={{ marginTop: 24, fontSize: 52, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1.05 }}>
          See the whole deal before the offer is made.
        </div>

        <div style={{ display: 'flex', marginTop: 20, fontSize: 24, color: C.grey1 }}>{dealSummary(SAMPLE)}</div>

        <div
          style={{
            marginTop: 28,
            width: W,
            display: 'flex',
            flexDirection: 'column',
            padding: 44,
            borderRadius: 24,
            background: C.greenTint,
            border: `2px solid ${C.green}`,
          }}
        >
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 500, color: C.green }}>{copy.label}</div>
          <div style={{ display: 'flex', marginTop: 10, fontSize: 108, fontWeight: 600, letterSpacing: -2, lineHeight: 1, color: C.green }}>
            {fmtMoney(copy.value)}
          </div>
          <div style={{ display: 'flex', marginTop: 16, width: W - 88, fontSize: 24, lineHeight: 1.35, color: C.ink }}>
            {grounding}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: medium, weight: 500, style: 'normal' },
        { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
      ],
    },
  );
}
