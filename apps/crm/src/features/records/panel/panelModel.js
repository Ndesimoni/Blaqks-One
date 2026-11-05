import { propertyPrice } from '../../../lib/properties.js';
import { get } from '../../../lib/records.js';

const text = (value) => String(value ?? '').trim();

/** A person's or listing's name, else a task's next action, else the record ID. */
export const recordTitle = (record, id) =>
  text(get(record, 'Full name')) ||
  text(get(record, 'Listing title')) ||
  text(get(record, 'Next action')) ||
  text(id);

/** People get an initials avatar in the panel header, as in the approved mockup. */
export const hasAvatar = (module) => module === 'Clients' || module === 'Contacts';

const kinds = {
  Clients: 'kindClients',
  Contacts: 'kindContacts',
  'Follow-ups': 'kindFollowUps',
  Viewings: 'kindViewings',
  Shortlist: 'kindShortlist',
  'Interaction log': 'kindInteractionLog',
  'Client care': 'kindClientCare',
  Deals: 'kindDeals',
};

/**
 * The `recordPanel` catalogue key naming the record kind at the start of the subtitle; '' for
 * a module without one. A client opened from Leads reads as a lead. Listings lead with price.
 */
export const kindKey = (module, lead = false) => (lead ? 'kindLeads' : kinds[module] || '');

const place = (record) =>
  [get(record, 'Community'), get(record, 'Emirate')].map(text).filter(Boolean).join(', ');

/** Facts after the kind: lead source, contact type and company, or a listing's price and place. */
export function subtitleParts(module, record, id) {
  const parts =
    {
      Clients: [get(record, 'Lead source')],
      Contacts: [get(record, 'Contact type'), get(record, 'Company')],
      Properties: [
        text(get(record, 'Price / annual rent AED')) ? propertyPrice(record) : '',
        place(record),
      ],
    }[module] || [];
  return [...parts, id].map(text).filter(Boolean);
}

const statusFields = [
  'Deal stage',
  'Listing status',
  'Viewing status',
  'Task status',
  'Action status',
  'Client response',
];

/** The record's own status for the header badge; a client's stage shows in the stage track. */
export function recordStatus(module, record) {
  if (module === 'Clients') return '';
  for (const label of statusFields) {
    const value = text(get(record, label));
    if (value) return value;
  }
  return '';
}
