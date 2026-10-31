import React from 'react';
import { canOpenSection } from '../access.js';
import { WebsiteTeam } from './team/WebsiteTeam.jsx';
import { WebsiteEnquiries } from './enquiries/WebsiteEnquiries.jsx';
import { WebsiteCompanies } from './companies/WebsiteCompanies.jsx';
import { WebsiteListings } from './listings/WebsiteListings.jsx';

/** The first tab holds the content editor, which stays mounted while other tabs open. */
export const contentTab = (platform) => (platform ? 'general' : 'content');

/** Website sections for this page; Enquiries needs the Clients module (enquiries/views.rs). */
export function websiteTabs(platform, user, t) {
  const ids = platform
    ? ['general', 'companies']
    : ['content', 'team', 'properties', 'enquiries'].filter(
        (id) => id !== 'enquiries' || canOpenSection(user, 'Clients'),
      );
  return ids.map((id) => ({ id, label: t(`websites.tabs.${id}`) }));
}

/** The open non-content tab; it loads its own data each time it opens. */
export function WebsitePanel({ tab, site, onGoToContent }) {
  if (tab === 'team') return <WebsiteTeam site={site ?? null} onGoToContent={onGoToContent} />;
  if (tab === 'properties') return <WebsiteListings site={site ?? null} />;
  if (tab === 'enquiries') return <WebsiteEnquiries siteId={site?.id} />;
  if (tab === 'companies') return <WebsiteCompanies />;
  return null;
}
