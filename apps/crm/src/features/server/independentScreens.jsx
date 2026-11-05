import React from 'react';
import { GoogleReturn } from './mailbox/GoogleReturn.jsx';
import { ServerAgreements } from './agreements/ServerAgreements.jsx';
import { ServerChannels } from './channels/ServerChannels.jsx';
import { ServerCompany } from './company/ServerCompany.jsx';
import { ServerInboxRules } from './inboxRules/ServerInboxRules.jsx';
import { ServerMailbox } from './mailbox/ServerMailbox.jsx';
import { ServerMarketplace } from './marketplace/ServerMarketplace.jsx';
import { ServerMarketplaceApplications } from './marketplace/ServerMarketplaceApplications.jsx';
import { ServerMyWhatsapp } from './myWhatsapp/ServerMyWhatsapp.jsx';
import { ServerProfile } from './profile/ServerProfile.jsx';
import { ServerSecurity } from './profile/ServerSecurity.jsx';
import { ServerTeamChat } from './chat/ServerTeamChat.jsx';
import { ServerWebsiteProfile } from './profile/ServerWebsiteProfile.jsx';
import { MarketplaceChats } from './marketChats/MarketplaceChats.jsx';
import { marketView } from './marketplace/marketViews.js';
import { PlatformDashboard } from './platformDashboard/PlatformDashboard.jsx';
import { PlatformTeamPage } from './platformTeam/PlatformTeamPage.jsx';
import { ServerWorkspaces } from './platformCompanies/ServerWorkspaces.jsx';
import { isPlatformMember } from './platformAccess.js';

/**
 * Pages independent of the selected workspace's records: the member's own account, company
 * settings, messaging, agreements and the Marketplace. Each route's element, or null.
 */
export function independentScreen(route, user) {
  if (route === 'Workspaces' && isPlatformMember(user)) return <ServerWorkspaces />;
  if (route === 'Platform dashboard') return <PlatformDashboard />;
  if (route === 'Blaqks One team') return <PlatformTeamPage />;
  if (route === 'My profile') return <ServerProfile />;
  if (route === 'Website profile') return <ServerWebsiteProfile />;
  if (route === 'Sign-in and security') return <ServerSecurity />;
  if (route === 'Channels') return <ServerChannels />;
  if (route === 'Company') return <ServerCompany />;
  if (route === 'Inbox rules') return <ServerInboxRules />;
  if (route === 'Team chat') return <ServerTeamChat />;
  if (route === 'Marketplace chats') return <MarketplaceChats />;
  if (route === 'Agreements') return <ServerAgreements />;
  const market = marketView(route);
  if (market) return <ServerMarketplace view={market} />;
  if (route === 'Marketplace applications') return <ServerMarketplaceApplications />;
  if (route === 'My mailbox') return <ServerMailbox />;
  if (route === 'Google sign-in') return <GoogleReturn />;
  if (route === 'My WhatsApp') return <ServerMyWhatsapp />;
  return null;
}
