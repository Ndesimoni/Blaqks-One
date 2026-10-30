import { matchesContactTab } from '../contacts/selectors.js';
import { normalizeEmail, normalizePhone, validPhone } from '../team/model.js';
import { validEmail } from './model.js';

export const recipientCategories = ['All', 'Clients', 'Leads', 'Landlords'];

/** Leads share client profiles. Contact categories follow the existing Contacts filters. */
export function recipientDirectory(clients = [], contacts = [], channel = 'email') {
  const entries = new Map();
  const add = (record, categories, source, index) => {
    const email = normalizeEmail(record.email);
    const phone = normalizePhone(record.phone);
    const address = channel === 'email' ? email : phone;
    const available = channel === 'email' ? validEmail(address) : validPhone(address);
    const name = String(
      record.full_name || record.client_id || record.contact_id || 'Unnamed contact',
    );
    // Valid addresses are the delivery identity. Missing/invalid details remain separate records.
    const key = available ? address : `${source}:${index}`;
    const entry = entries.get(key) || {
      key,
      address,
      available,
      names: [],
      categories: [],
      searchTerms: [],
      phones: [],
    };
    if (!entry.names.includes(name)) entry.names.push(name);
    entry.categories = [...new Set([...entry.categories, ...categories])];
    entry.searchTerms.push(name.toLowerCase(), email, String(record.phone || '').toLowerCase());
    entry.phones.push(phone);
    entries.set(key, entry);
  };
  clients.forEach((record, index) => add(record, ['Clients', 'Leads'], 'client', index));
  contacts.forEach((record, index) => {
    const categories = matchesContactTab(record, 'Landlords')
      ? ['Landlords']
      : matchesContactTab(record, 'Clients')
        ? ['Clients']
        : ['Other contacts'];
    add(record, categories, 'contact', index);
  });
  return [...entries.values()]
    .map((entry) => ({ ...entry, name: entry.names.join(' / ') }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function filterRecipientDirectory(entries, search = '', category = 'All') {
  const query = search.trim().toLowerCase();
  const phoneQuery = normalizePhone(query);
  const searchPhone = /\d{3}/.test(phoneQuery);
  return entries.filter(
    (entry) =>
      (category === 'All' || entry.categories.includes(category)) &&
      (!query ||
        entry.searchTerms.some((term) => term.includes(query)) ||
        (searchPhone && entry.phones.some((phone) => phone.includes(phoneQuery)))),
  );
}
