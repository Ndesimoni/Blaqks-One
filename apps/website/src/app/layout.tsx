import type { Metadata } from 'next';
import { currentSite } from '@/lib/site';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import '@/styles/index.css';

export const metadata: Metadata = {
  title: 'Blaqks One',
  description: 'Find your next place in the UAE.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { site } = await currentSite();
  return (
    <html lang="en">
      <body data-theme={site.theme} data-site-kind={site.kind} data-site={site.id}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {site.sample && (
          <div className="sample-banner" role="note">
            Website preview · Fictional listings and contacts · Sample photography and developer
            associations · Nothing is sent to the CRM
          </div>
        )}
        <SiteHeader site={site} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter site={site} />
      </body>
    </html>
  );
}
