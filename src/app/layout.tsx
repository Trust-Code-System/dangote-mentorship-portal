import type { Metadata } from 'next';
import { Public_Sans, Instrument_Serif } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

// Self-hosted font (Stitch redesign — docs/stitch-redesign.md). next/font
// downloads and serves Public Sans from our own origin at build time — no
// runtime Google requests, so it works offline / on low-bandwidth plant
// connections. Public Sans (an open, institutional grotesque) powers the whole
// UI: heavy weights (700) for headings, regular for body/UI/data — so
// `--font-inter` (variable name kept for zero-refactor) maps to Public Sans for
// both the display and sans families.
const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

// The public landing page's editorial display face (LANDING_PAGE_MASTER_SPEC.md
// §3). Two families total across the product: Public Sans for everything, and
// this serif used sparingly for emotional statements on the marketing home.
// Nothing in the authenticated portal references `font-serif`, so adding the
// variable here is inert for the app shell. Also self-hosted by next/font.
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL ?? 'http://localhost:3000'),
  title: 'BLAK MOH',
  description: 'Learning and optimal wellbeing through intelligent, bilingual mentorship.',
  // Confidential internal portal — never index (production-readiness-report.md M5).
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${publicSans.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-body text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        {/* Vercel Web Analytics — first-party script (/_vercel/insights/*),
            same-origin beacon, so the existing CSP ('self') already allows it.
            Inert outside Vercel; no PII collected (no cookies, anonymized). */}
        <Analytics />
      </body>
    </html>
  );
}
