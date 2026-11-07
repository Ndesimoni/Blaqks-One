import { today } from '../../../lib/dates.js';
import { canOpenSection } from '../access.js';
import { canReplyOn } from '../inbox/inboxModel.js';

/**
 * Bitrix24's Create (NAV5): the records a product can start from the top bar. Each item opens
 * its module's own editor through the workspace `add`, with the page's own defaults: a lead is
 * a client at stage New, as Add lead on the Leads page makes it. Messages starts an email
 * or a group chat on its own page (`start`); other products show no Create yet.
 */
const crm = [
  { key: 'lead', module: 'Clients', defaults: () => ({ lead_stage: 'New', date_added: today() }) },
  { key: 'client', module: 'Clients' },
  { key: 'contact', module: 'Contacts' },
  { key: 'property', module: 'Properties' },
  { key: 'followUp', module: 'Follow-ups' },
  { key: 'viewing', module: 'Viewings' },
];

/** Records only their own page creates, offered first while that page is open. */
const ownPage = {
  Shortlist: { key: 'shortlist', module: 'Shortlist' },
  'Interaction log': { key: 'interaction', module: 'Interaction log' },
  'Client care': { key: 'clientCare', module: 'Client care' },
};

/** Messages (approved mockup): New email and New group live here, not in the lists. */
const messages = [
  { key: 'email', route: 'Inbox', start: 'email', allowed: (user) => canReplyOn(user, 'email') },
  { key: 'group', route: 'Team chat', start: 'group', allowed: () => true },
];

/**
 * The Create items for a product, limited to the modules `can(module, 'create')` allows; on
 * the Shortlist, Interaction log and Client care pages their own records come first, since
 * the lists themselves have no Add buttons (approved mockup).
 */
export function createItems(product, can, route, user) {
  if (product === 'messages')
    return messages.filter((item) => canOpenSection(user, item.route) && item.allowed(user));
  if (product !== 'crm') return [];
  const items = ownPage[route] ? [ownPage[route], ...crm] : crm;
  return items.filter((item) => can(item.module, 'create'));
}
