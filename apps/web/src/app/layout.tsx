import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

// One family for both scripts: IBM Plex Sans Thai carries matching Latin, so Thai names and English
// labels share one rhythm. Plex's industrial heritage suits a minerals company's work console.
const plex = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Employee Console', template: '%s — Employee Console' },
  description: 'Manage employee records from the source spreadsheet.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#09532d', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
