import type { Metadata } from 'next';
import { Instrument_Serif, Instrument_Sans } from 'next/font/google';
import './globals.css';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--display' });
const sans = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--sans' });

const TITLE = 'IOI — See the whole deal before the offer is made';
const DESC =
  'Your comp plan, quota and accelerator, live on every deal. Drag a discount and watch exactly what it costs you. Free, no signup to try.';

export const metadata: Metadata = {
  metadataBase: new URL('https://tryioi.com'),
  title: { default: TITLE, template: '%s' },
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: 'https://tryioi.com', siteName: 'IOI', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
