import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEMO_PLAN } from '@/lib/calc';
import { fmtCredit, fmtMoney, fmtPctShort } from '@/lib/format';
import { OPENING_PTD, SAMPLE, dealLine, outcome } from '@/components/opening';

/**
 * The card LinkedIn unfurls is the opening state of the page, rendered from
 * the same engine, the same numbers and the same family (static Inter cuts).
 * Everything sits at least 12px inside the 1200×627 crop.
 */

export const alt =
  'IOI — See the whole deal before the offer is made. A 5% discount keeps this rep $130 under their accelerator: $4,298.75 left on the table.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const C = {
  paper: '#F5F2EB',
  stage: '#FDFCF9',
  ink: '#17150F',
  grey1: '#5F5A50',
  hair: '#E4DFD4',
  red: '#B42318',
  redTint: 'rgba(180,35,24,.22)',
};

const font = (file: string) => readFile(join(process.cwd(), 'src/app/_fonts', file));

export default async function Image() {
  const [regular, medium, semibold] = await Promise.all([
    font('Inter-Regular.ttf'),
    font('Inter-Medium.ttf'),
    font('Inter-SemiBold.ttf'),
  ]);

  const o = outcome(DEMO_PLAN, SAMPLE, OPENING_PTD);
  const m = dealLine(DEMO_PLAN, OPENING_PTD, o.r);
  const W = 1072;
  const px = (f: number) => Math.round(f * W);
  const ringX = px(m.ringX ?? 0);
  const short = DEMO_PLAN.accelerator_threshold - o.r.creditAfter;
  const sentence = `A ${fmtPctShort(SAMPLE.subscriptionDiscountPct)} discount keeps this rep ${fmtCredit(DEMO_PLAN, short)} under their accelerator — and ${fmtMoney(o.r.crossingWorth)} of it is on deals already closed.`;

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="30" height="14" viewBox="0 0 30 14">
              <rect x="0" y="0" width="2" height="14" fill={C.ink} />
              <rect x="28" y="0" width="2" height="14" fill={C.ink} />
              <rect x="2" y="6.25" width="26" height="1.5" fill={C.ink} opacity="0.35" />
              <circle cx="15" cy="7" r="4" fill={C.stage} stroke={C.ink} strokeWidth="2" />
            </svg>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: 1 }}>IOI</div>
          </div>
          <div style={{ fontSize: 20, color: C.grey1 }}>tryioi.com</div>
        </div>

        <div style={{ marginTop: 24, fontSize: 52, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1.05 }}>
          See the whole deal before the offer is made.
        </div>

        <div style={{ marginTop: 32, width: W, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', height: 26, display: 'flex' }}>
            <div style={{ position: 'absolute', left: ringX, top: 0, fontSize: 20, color: C.grey1, whiteSpace: 'nowrap' }}>
              {m.marker}
            </div>
          </div>
          <div style={{ position: 'relative', height: 20, marginTop: 8, display: 'flex' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 2, background: C.hair }} />
            <div style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 20, background: C.ink }} />
            <div style={{ position: 'absolute', left: 0, top: 6, width: px(m.barW), height: 8, background: C.ink, borderRadius: 4 }} />
            <div
              style={{
                position: 'absolute',
                left: px(m.ghostX),
                top: 6,
                width: px(m.ghostW),
                height: 8,
                background: C.redTint,
                borderRadius: 4,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: ringX - 7,
                top: 3,
                width: 14,
                height: 14,
                borderRadius: 7,
                border: `2px solid ${C.ink}`,
                background: C.stage,
              }}
            />
          </div>
          <div style={{ position: 'relative', height: 26, marginTop: 8, display: 'flex' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, fontSize: 20, color: C.grey1, whiteSpace: 'nowrap' }}>
              {m.origin}
            </div>
            <div
              style={{
                position: 'absolute',
                left: ringX - 100,
                top: 0,
                width: 200,
                display: 'flex',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 500,
                color: C.red,
              }}
            >
              {m.callout?.text}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 28, fontSize: 22, color: C.grey1 }}>Left on the table</div>
        <div style={{ marginTop: 8, fontSize: 128, fontWeight: 600, letterSpacing: -3, lineHeight: 1, color: C.red }}>
          {fmtMoney(o.atStake)}
        </div>
        <div style={{ marginTop: 12, width: W, fontSize: 24, lineHeight: 1.3 }}>{sentence}</div>
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
