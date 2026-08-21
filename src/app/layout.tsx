import type { Metadata } from 'next';
import { Archivo, Figtree, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const display = Archivo({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--display',
});

const sans = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--sans',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--mono',
});

export const metadata: Metadata = {
  title: 'IOI — Information over incentive',
  description: 'See the whole deal before the offer is made. Built for MarginEdge.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
