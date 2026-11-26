import { labels } from '../../../config/navigation.js';
import { activityLabel } from '../access.js';
import { websiteRoute } from '../website/websiteRoutes.js';

/** Routes whose name comes from their own catalogue namespace. */
const translated = {
  Inbox: 'inbox',
  'Team chat': 'chat',
  Channels: 'channels',
  'Inbox rules': 'inboxRules',
  'My mailbox': 'mailbox',
  'Google sign-in': 'mailbox',
  'My WhatsApp': 'myWhatsapp',
  Agreements: 'agreements',
  'Shared record': 'recordShares',
  'Platform dashboard': 'platformMetrics',
  'Blaqks One team': 'platformTeam',
  Help: 'help',
  'Help requests': 'help',
  'Blaqks One clients': 'platformClients',
};

/** Pages that render their own main heading; the top bar then names them as plain text. */
export const OWN_HEADING = ['Start', 'Inbox', 'Team chat'];

/**
 * A page's name in the top bar (NAV5): the names the in-page headings always used, so every
 * page keeps exactly one main heading with the same text.
 */
export function pageTitle(route, user, t) {
  if (route === 'Start') return t('start.home');
  if (route === 'Team & access') return 'Team';
  const website = websiteRoute(route);
  if (website) return t(website.title);
  const title = route === 'Team activity' ? activityLabel(user) : route;
  const key = translated[title];
  if (key) return t(`${key}.title`);
  if (title === 'My profile') return 'My profile';
  return labels[title] || title || 'Your CRM workspace';
}
