import type { Metadata, Viewport } from 'next';
import { Anuphan, Archivo } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

// Archivo's width axis (62–125) gives titles and numerals their voice; Anuphan covers Thai names and reports.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const anuphan = Anuphan({ subsets: ['thai', 'latin'], variable: '--font-anuphan', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Employee Console', template: '%s — Employee Console' },
  description: 'Manage employee records from the source spreadsheet.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#f3f5f1', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${anuphan.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
