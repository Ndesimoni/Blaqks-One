import { CompanyHeader, CompanyFooter } from '@/components/company/CompanyChrome';
import { HomeverseHeader, HomeverseFooter } from '@/components/homeverse/HomeverseChrome';
import { isCompanyDesign, isHomeverse } from '@/lib/company-design';
import type { Metadata } from 'next';
import { currentSite } from '@/lib/site';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { Motion } from '@/components/motion/Motion';

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
            {isHomeverse(site) ? (
              <HomeverseHeader site={site} />
            ) : isCompanyDesign(site) ? (
              <CompanyHeader site={site} />
            ) : (
              <SiteHeader site={site} />
            )}
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <Motion />
            {isHomeverse(site) ? (
              <HomeverseFooter site={site} />
            ) : isCompanyDesign(site) ? (
              <CompanyFooter site={site} />
            ) : (
              <SiteFooter site={site} />
            )}
          </>
        )}
      </body>
    </html>
  );
}
