import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import SetTimeZoneCookie from '@/components/SetTimeZoneCookie';
import './globals.css';

// One family. The optical-size axis gives the display cut above 32px; the
// tabular figures come from the font itself (see :root in globals.css).
const inter = Inter({ subsets: ['latin'], axes: ['opsz'], variable: '--font-inter', display: 'swap' });

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
    <html lang="en" className={inter.variable}>
      <body>
        <SetTimeZoneCookie />
        {children}
      </body>
    </html>
  );
}
