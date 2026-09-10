import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--mono' });

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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
