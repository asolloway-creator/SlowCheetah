import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEMO_PLAN } from '@/lib/calc';
import { fmtMoney, fmtPctShort } from '@/lib/format';
import {
  OPENING_PTD,
  OPENING_QTD,
  SAMPLE,
  crossEffect,
  kickerCrossDiscountPct,
  kickerOutcomeCopy,
  outcome,
  outcomeCopy,
} from '@/components/opening';

/**
 * The card LinkedIn/iMessage/Slack unfurl: the landing page's first screen in
 * miniature, the headline beside the sample result card on its sunflower
 * block. Every figure comes from the same engine and the same SAMPLE the
 * live page opens on (0% subscription discount, which unlocks the Quarterly
 * Bonus), never typed in. Read-only: SAMPLE/OPENING_PTD/OPENING_QTD also
 * seed the live app's pre-hydration frame, so nothing here may redefine them.
 *
 * Satori (this renderer) drops whitespace at element boundaries, so any text
 * split across elements is laid out as separate flex items with a gap.
 */

export const alt =
  'IOI. Know what a deal pays. And what it costs. On the sample deal: $2,216.16 commission, and it unlocks a $10,780.92 Quarterly Bonus.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const C = {
  cream: '#F7F1E3',
  paper: '#FFFDF8',
  ink: '#1C1812',
  ink2: '#4D463A',
  ink3: '#6F6656',
  onInk: '#FFF8E7',
  line: '#EAE1CE',
  line2: '#DCD1BB',
  sun: '#FFC21A',
  sunWash: '#FFF5D6',
  green: '#0A7A3D',
  greenWash: '#E8F4EB',
};

const font = (file: string) => readFile(join(process.cwd(), 'src/app/_fonts', file));

/** The "I O I" of the expansion picked out in bold, word by word. */
function Expansion() {
  const words: [string, string][] = [
    ['I', 'nformation'],
    ['o', 'ver'],
    ['i', 'ncentive'],
  ];
  return (
    <div style={{ display: 'flex', gap: 5, fontSize: 17, color: C.ink3 }}>
      {words.map(([first, rest]) => (
        <div key={first} style={{ display: 'flex' }}>
          <div style={{ display: 'flex', fontWeight: 600, color: C.ink }}>{first}</div>
          <div style={{ display: 'flex' }}>{rest}</div>
        </div>
      ))}
    </div>
  );
}

export default async function Image() {
  const [regular, medium, semibold, display] = await Promise.all([
    font('Inter-Regular.ttf'),
    font('Inter-Medium.ttf'),
    font('Inter-SemiBold.ttf'),
    font('BricolageGrotesque-ExtraBold.ttf'),
  ]);

  const o = outcome(DEMO_PLAN, SAMPLE, OPENING_PTD);
  const copy = outcomeCopy(DEMO_PLAN, SAMPLE, o, OPENING_PTD);
  const bonus = kickerOutcomeCopy(DEMO_PLAN, crossEffect(DEMO_PLAN, o, OPENING_QTD), OPENING_QTD);
  const line = kickerCrossDiscountPct(DEMO_PLAN, o, OPENING_QTD);
  // SAMPLE at rest is known to unlock the tier (see DEMO_PLAN in calc.ts).
  if (!bonus || bonus.tone !== 'green' || line === null || copy.figure === null) {
    throw new Error('opengraph-image: expected SAMPLE to unlock a Quarterly Bonus tier');
  }

  // Slider geometry: same formula as the live one (half a thumb + the rest × value / 100).
  const TRACK = 400;
  const THUMB = 26;
  const lineX = THUMB / 2 + ((TRACK - THUMB) * line) / 100;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: C.cream, color: C.ink, fontFamily: 'Inter' }}>
        {/* left: wordmark, tag, headline, address */}
        <div style={{ position: 'absolute', left: 64, top: 52, bottom: 52, width: 560, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Bricolage', fontSize: 34, letterSpacing: -0.6 }}>
              <div style={{ display: 'flex' }}>I</div>
              <svg width="27" height="27" viewBox="0 0 24 24" style={{ margin: '0 2px' }}>
                <circle cx="12" cy="12" r="8.3" fill={C.sun} stroke={C.ink} strokeWidth="3.6" />
              </svg>
              <div style={{ display: 'flex' }}>I</div>
            </div>
            <div style={{ display: 'flex', width: 1, height: 22, background: C.line2 }} />
            <Expansion />
          </div>

          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start', marginTop: 44,
              height: 38, padding: '0 16px 0 13px', borderRadius: 999, background: '#FFFFFF', border: '1px solid rgba(28,24,18,0.08)',
              fontSize: 16, fontWeight: 500, color: C.ink2,
            }}
          >
            <div style={{ display: 'flex', width: 13, height: 13, borderRadius: 999, background: C.sun, border: `2.5px solid ${C.ink}` }} />
            <div style={{ display: 'flex' }}>Pricing and deal intelligence for sales reps</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26, fontFamily: 'Bricolage', fontSize: 72, lineHeight: 1, letterSpacing: -2.1 }}>
            <div style={{ display: 'flex' }}>Know what a</div>
            <div style={{ display: 'flex' }}>deal pays.</div>
            <div style={{ display: 'flex', position: 'relative', alignSelf: 'flex-start' }}>
              <div style={{ position: 'absolute', left: -3, right: -4, bottom: 5, height: 25, background: C.sun, borderRadius: 3 }} />
              <div style={{ display: 'flex' }}>And what it costs.</div>
            </div>
          </div>

          <div style={{ display: 'flex', marginTop: 24, width: 520, fontSize: 22, lineHeight: 1.45, color: C.ink2 }}>
            Your commission, your accelerator and your bonus, before you make the offer.
          </div>

          <div style={{ display: 'flex', marginTop: 'auto', fontSize: 21, fontWeight: 600, color: C.ink }}>tryioi.com</div>
        </div>

        {/* right: the sunflower block */}
        <div
          style={{
            position: 'absolute', left: 664, top: 34, width: 500, height: 640, borderRadius: 40, overflow: 'hidden', display: 'flex',
            backgroundImage: 'linear-gradient(160deg, #FFD75E 0%, #FFC62A 30%, #FFC21A 55%, #F7B500 100%)',
          }}
        >
          <div style={{ position: 'absolute', right: -170, bottom: -150, width: 460, height: 460, borderRadius: 999, border: '56px solid rgba(255,235,160,0.38)' }} />
        </div>

        {/* the sample result card */}
        <div
          style={{
            position: 'absolute', left: 690, top: 70, width: 448, display: 'flex', flexDirection: 'column',
            background: '#FFFFFF', borderRadius: 24, overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(28,24,18,0.08), 0 30px 60px -20px rgba(74,50,0,0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 24px', background: C.paper, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: 'flex', fontSize: 15, fontWeight: 600, color: C.ink }}>This is a sample month.</div>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 7, height: 26, padding: '0 11px', borderRadius: 999,
                background: C.sunWash, border: '1px solid rgba(214,150,0,0.4)', fontSize: 12, fontWeight: 600, letterSpacing: 0.8, color: '#5C4300',
              }}
            >
              <div style={{ display: 'flex', width: 7, height: 7, borderRadius: 999, background: '#F5B400' }} />
              <div style={{ display: 'flex' }}>LIVE</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 600, color: C.ink2 }}>
              <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 2.5, background: C.sun }} />
              <div style={{ display: 'flex' }}>{copy.name}</div>
            </div>
            <div style={{ display: 'flex', marginTop: 10, fontFamily: 'Bricolage', fontSize: 72, lineHeight: 0.95, letterSpacing: -2.4, color: C.green }}>
              {copy.figureText}
            </div>
            <div style={{ display: 'flex', marginTop: 10, fontSize: 14, fontWeight: 500, color: C.ink3 }}>{copy.caption}</div>

            {/* the discount slider at rest, with the line where the bonus is lost */}
            <div style={{ display: 'flex', position: 'relative', width: TRACK, height: 82, marginTop: 20 }}>
              <div
                style={{
                  position: 'absolute', left: 0, top: 0, display: 'flex', height: 24, padding: '0 8px', borderRadius: 7,
                  background: C.ink, color: C.onInk, fontSize: 13, fontWeight: 600, alignItems: 'center',
                }}
              >
                0%
              </div>
              <div
                style={{
                  position: 'absolute', left: 0, top: 34, width: TRACK, height: 20, borderRadius: 10, display: 'flex', overflow: 'hidden',
                  background: '#FFFFFF', border: `1px solid ${C.line2}`,
                }}
              >
                <div
                  style={{
                    position: 'absolute', left: lineX, top: 0, bottom: 0, right: 0, display: 'flex',
                    backgroundImage: 'repeating-linear-gradient(135deg, rgba(28,24,18,0.09) 0px, rgba(28,24,18,0.09) 4px, transparent 4px, transparent 9px)',
                  }}
                />
              </div>
              <div style={{ position: 'absolute', left: lineX - 1.5, top: 26, width: 3, height: 36, borderRadius: 2, background: C.ink, display: 'flex' }} />
              <div
                style={{
                  position: 'absolute', left: 0, top: 29, width: THUMB, height: 30, borderRadius: 9, display: 'flex',
                  background: '#FFFFFF', border: `2px solid ${C.ink}`, boxShadow: '0 6px 14px -8px rgba(28,24,18,0.6)',
                }}
              />
              <div
                style={{
                  position: 'absolute', left: lineX - 26, top: 62, display: 'flex', height: 20, padding: '0 7px', borderRadius: 5,
                  background: C.ink, color: '#FFFFFF', fontSize: 12, fontWeight: 600, alignItems: 'center',
                }}
              >
                {fmtPctShort(line)}
              </div>
            </div>

            <div
              style={{
                display: 'flex', flexDirection: 'column', marginTop: 14, padding: '14px 18px', borderRadius: 16,
                background: C.greenWash, border: '1px solid rgba(10,122,61,0.2)',
              }}
            >
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 600, color: C.ink }}>{`${bonus.label}:`}</div>
              <div style={{ display: 'flex', marginTop: 6, fontFamily: 'Bricolage', fontSize: 38, lineHeight: 1, letterSpacing: -0.8, color: C.green }}>
                {fmtMoney(bonus.value)}
              </div>
            </div>
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
        { name: 'Bricolage', data: display, weight: 800, style: 'normal' },
      ],
    },
  );
}
