import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { themeScript } from '@/lib/theme';
import '@/styles/index.css';

const sans = Figtree({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002'),
  title: {
    default: 'Blaqks One · The workspace for UAE real estate teams',
    template: '%s · Blaqks One',
  },
  description:
    'Leads, listings, your company website, the broker marketplace and every client message, together in one place. Free for your first three seats.',
};

/** Every page: skip link, menu, the page, footer and the WhatsApp button. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Dark until the shared theme script runs; it may change the attribute before React does.
    <html lang="en" className={sans.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Nav />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
