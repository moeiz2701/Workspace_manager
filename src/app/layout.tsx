import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

/**
 * Inter for UI text — it is the most legible face at the 12–14px this app
 * mostly lives at, and its tabular figures keep the counts and progress
 * numbers from jittering. JetBrains Mono carries task keys and code.
 *
 * The variable names here must match the ones globals.css reads in @theme.
 */
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Entropable Workspace',
  description: 'Implementation workspace for the Entropable trading platform build.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfd' },
    { media: '(prefers-color-scheme: dark)', color: '#16161c' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * The font variables MUST sit on <html>, not <body>. Custom properties only
     * inherit downward, and globals.css applies `font-sans` to the html element
     * — with the variables one level below, `var(--font-inter)` was undefined at
     * the element that consumes it, which makes the whole font-family
     * declaration invalid at computed-value time and drops the page to the
     * browser's default serif. next-themes only classList.add/remove's its own
     * theme names here, so these classes survive a theme change.
     */
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <Providers>
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
