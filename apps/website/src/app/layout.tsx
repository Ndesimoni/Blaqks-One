import type { Metadata } from 'next';
import { currentSite } from '@/lib/site';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export const metadata: Metadata = {
  title: 'Blaqks One',
  description: 'Find your next place in the UAE.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { site } = await currentSite();
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href={site.kind === 'platform' ? '/approved/reference.css' : '/approved/company.css'}
        />
      </head>
      <body data-theme={site.theme} data-site-kind={site.kind} data-site={site.id}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {site.sample && site.kind !== 'platform' && (
          <div className="sample-banner" role="note">
            Website preview · Fictional listings and contacts · Sample photography and developer
            associations · Nothing is sent to the CRM
          </div>
        )}
        {site.kind === 'platform' ? (
          children
        ) : (
          <>
            <SiteHeader site={site} />
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <SiteFooter site={site} />
          </>
        )}
      </body>
    </html>
  );
}
