import { ImageResponse } from 'next/og';

export const alt = 'IOI — see the whole deal before the offer is made';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#0A0D10', color: '#E8EEF2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, fontFamily: 'serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 10, background: '#3DF28B', color: '#0A0D10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>IOI</div>
          <div style={{ fontSize: 22, color: '#98A6B3' }}>information over incentive · tryioi.com</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            <div>See the whole deal</div>
            <div style={{ color: '#3DF28B' }}>before the offer is made.</div>
          </div>
          <div style={{ fontSize: 26, color: '#98A6B3', maxWidth: 900 }}>Your comp plan, quota and accelerator — live on every deal.</div>
        </div>
        <div style={{ display: 'flex', gap: 40, fontSize: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ color: '#5F6E7B', fontSize: 14, letterSpacing: 2 }}>COMMISSION</div><div style={{ color: '#3DF28B', fontSize: 34 }}>$2,800.00</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ color: '#5F6E7B', fontSize: 14, letterSpacing: 2 }}>MONEY LEFT ON TABLE</div><div style={{ color: '#FF5C5C', fontSize: 34 }}>$3,888.75</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ color: '#5F6E7B', fontSize: 14, letterSpacing: 2 }}>TO ACCELERATOR</div><div style={{ color: '#F5B942', fontSize: 34 }}>$12,670</div></div>
        </div>
      </div>
    ),
    { ...size },
  );
}
