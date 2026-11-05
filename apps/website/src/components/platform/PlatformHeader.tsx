import Link from 'next/link';
import type { Site } from '../../lib/types';
import { crmEntry } from '../../lib/crm-entry';
import { PlatformSearch } from './PlatformSearch';
import { PlatformNavigation, ProfessionalMenu } from './PlatformNavigation';

export function PlatformHeader({ site }: { site: Site }) {
  const crm = crmEntry();
  return (
    <header className="platform-header">
      <div className="platform-header-inner">
        <Link className="platform-wordmark" href="/" aria-label={`${site.name} home`}>
          <svg viewBox="0 0 32 38" width="30" height="38" fill="none" aria-hidden="true">
            <path
              d="M3 35V12l10-6v29m0-27 9-5v32M22 13l7 4v18M7 17v3m0 4v3m10-13v3m0 4v3m9-3v5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
          <span>
            {site.name}
            <small>EXCEPTIONAL REAL ESTATE</small>
          </span>
        </Link>
        <PlatformSearch />
        <PlatformNavigation />
        <ProfessionalMenu>
          <div>
            <p className="eyebrow">YOUR PROFESSIONAL WORKSPACE</p>
            <a href={crm || '/professionals'}>CRM sign in ↗</a>
            <a href={crm ? `${crm.replace(/\/$/, '')}/#/sign-up` : '/professionals'}>
              Create an account ↗
            </a>
            <Link href="/professionals">Explore Blaqks One for professionals →</Link>
            <Link href="/developers">UAE developers</Link>
            <Link href="/areas">Neighbourhoods</Link>
            <Link href="/contact">Contact Blaqks One</Link>
          </div>
        </ProfessionalMenu>
      </div>
    </header>
  );
}
