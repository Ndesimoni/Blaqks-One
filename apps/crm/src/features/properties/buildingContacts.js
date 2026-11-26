import { get } from '../../lib/records.js';

/** Building names compare case-insensitively with trimmed, collapsed whitespace. */
export const normalizeBuilding = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const sameBuilding = (a, b) => {
  const left = normalizeBuilding(a);
  return Boolean(left) && left === normalizeBuilding(b);
};

const idOf = (record, label) => String(get(record, label) ?? '').trim();

/** The loaded contact with this ID, or null when it is missing or hidden from the viewer. */
export function findContact(contacts = [], id) {
  const wanted = String(id ?? '').trim();
  if (!wanted) return null;
  return contacts.find((contact) => idOf(contact, 'Contact ID') === wanted) || null;
}

/** "Full name · Contact type", falling back to the contact ID when the name is blank. */
export function contactLabel(contact) {
  const name = String(get(contact, 'Full name') ?? '').trim() || idOf(contact, 'Contact ID');
  const type = String(get(contact, 'Contact type') ?? '').trim();
  return type ? `${name} · ${type}` : name;
}

/** Security guards first, then building managers, then every other contact type. */
const typeRank = (contact) => {
  const type = normalizeBuilding(get(contact, 'Contact type'));
  return type === 'security guard' ? 0 : type === 'building manager' ? 1 : 2;
};

const byName = (a, b) =>
  String(get(a, 'Full name') ?? '').localeCompare(String(get(b, 'Full name') ?? ''), undefined, {
    sensitivity: 'base',
  }) || idOf(a, 'Contact ID').localeCompare(idOf(b, 'Contact ID'));

/**
 * Loaded contacts saved for the property's Building / project, excluding its linked contact,
 * which the details already show. Without a building there is nothing to match.
 */
export function selectBuildingContacts(contacts = [], property) {
  const building = get(property, 'Building / project');
  if (!normalizeBuilding(building)) return [];
  const linked = idOf(property, 'Contact ID');
  return contacts
    .filter((contact) => sameBuilding(building, get(contact, 'Building / project')))
    .filter((contact) => !linked || idOf(contact, 'Contact ID') !== linked)
    .sort((a, b) => typeRank(a) - typeRank(b) || byName(a, b));
}

/** A dialable tel: href from a displayed phone number, or '' when it has no digits. */
export function telHref(phone) {
  const raw = String(phone ?? '').trim();
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  return `tel:${raw.startsWith('+') || raw.startsWith('00') ? '+' : ''}${digits.replace(/^00/, '')}`;
}
