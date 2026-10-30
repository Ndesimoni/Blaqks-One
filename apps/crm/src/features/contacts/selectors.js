import { get } from '../../lib/records.js';

/** Each named tab shows exactly one contact type; Other contacts collects everything else. */
const tabTypes = {
  Landlords: 'landlord',
  Clients: 'client',
  'Security guards': 'security guard',
  'Building managers': 'building manager',
};

export const contactTabs = ['All', ...Object.keys(tabTypes), 'Other contacts'];

const namedTypes = new Set(Object.values(tabTypes));

/** Unknown and unclassified imported types remain accessible in Other contacts. */
export function matchesContactTab(record, tab) {
  const type = String(get(record, 'Contact type') ?? '')
    .trim()
    .toLowerCase();
  if (Object.hasOwn(tabTypes, tab)) return type === tabTypes[tab];
  if (tab === 'Other contacts') return !namedTypes.has(type);
  return true;
}
