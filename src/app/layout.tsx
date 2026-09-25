import type { Metadata } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import SetTimeZoneCookie from '@/components/SetTimeZoneCookie';
import './globals.css';

// Bricolage for display and money (it carries true tabular figures), Inter
// for everything a rep reads or types.
const display = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-display', display: 'swap' });
const inter = Inter({ subsets: ['latin'], axes: ['opsz'], variable: '--font-inter', display: 'swap' });

const TITLE = 'IOI · Know what a deal pays. And what it costs.';
const DESC =
  'Pricing and deal intelligence for sales reps. Drag a discount and see what it pays you, what it costs you and what it puts at stake, before you make the offer.';

export const metadata: Metadata = {
  metadataBase: new URL('https://tryioi.com'),
  title: { default: TITLE, template: '%s' },
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: 'https://tryioi.com', siteName: 'IOI', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>
        <SetTimeZoneCookie />
        {children}
      </body>
    </html>
  );
}
