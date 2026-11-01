import { today } from '../../../lib/dates.js';

/**
 * Bitrix24's Create (NAV5): the records a product can start from the top bar. Each item opens
 * its module's own editor through the workspace `add`, with the page's own defaults: a lead is
 * a client at stage New, as Add lead on the Leads page makes it. Only CRM records are listed
 * so far; other products show no Create until their forms can open from the top bar.
 */
const crm = [
  { key: 'lead', module: 'Clients', defaults: () => ({ lead_stage: 'New', date_added: today() }) },
  { key: 'client', module: 'Clients' },
  { key: 'contact', module: 'Contacts' },
  { key: 'property', module: 'Properties' },
  { key: 'followUp', module: 'Follow-ups' },
  { key: 'viewing', module: 'Viewings' },
];

/** The Create items for a product, limited to the modules `can(module, 'create')` allows. */
export function createItems(product, can) {
  return product === 'crm' ? crm.filter((item) => can(item.module, 'create')) : [];
}
