import React from 'react';
import { WebsiteTeam } from './team/WebsiteTeam.jsx';
import { WebsiteEnquiries } from './enquiries/WebsiteEnquiries.jsx';
import { WebsiteCompanies } from './companies/WebsiteCompanies.jsx';
import { WebsiteListings } from './listings/WebsiteListings.jsx';

/** The first section holds the content editor, which stays mounted while others open. */
export const contentTab = (platform) => (platform ? 'general' : 'content');

/** The open non-content section; it loads its own data each time it opens. */
export function WebsitePanel({ tab, site, onGoToContent }) {
  if (tab === 'team') return <WebsiteTeam site={site ?? null} onGoToContent={onGoToContent} />;
  if (tab === 'properties') return <WebsiteListings site={site ?? null} />;
  if (tab === 'enquiries') return <WebsiteEnquiries siteId={site?.id} />;
  if (tab === 'companies') return <WebsiteCompanies />;
  return null;
}
