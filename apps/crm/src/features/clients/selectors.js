import { get, prName } from '../../lib/records.js';
import { dateNum } from '../../lib/dates.js';
import { selectRecords } from '../../lib/workspace.js';

export function selectClientDesk(data, query, selectedClient) {
  const clients = selectRecords(data, 'Clients', { query });
  const client = clients.find((row) => get(row, 'Client ID') === selectedClient) || clients[0];
  return { clients, client, matches: selectClientMatches(data.Properties, client) };
}

export function selectClientMatches(properties, client) {
  if (!client) return [];
  const target = String(get(client, 'Buy / rent') || '').toLowerCase();
  const budget = Number(get(client, 'Maximum budget AED')) || Infinity;
  const communities = String(get(client, 'Preferred communities') || '').toLowerCase();
  return properties
    .filter((property) => {
      const mode = String(get(property, 'Sale / rental') || '').toLowerCase();
      const price = Number(get(property, 'Price / annual rent AED')) || 0;
      const community = String(get(property, 'Community') || '').toLowerCase();
      return (
        (!target ||
          (target === 'buy' && mode === 'sale') ||
          (target === 'rent' && mode === 'rental')) &&
        price <= budget * 1.08 &&
        (!communities ||
          communities.split(',').some((value) => value.trim() && community.includes(value.trim())))
      );
    })
    .sort(
      (a, b) =>
        Number(get(a, 'Price / annual rent AED')) - Number(get(b, 'Price / annual rent AED')),
    );
}

export function selectClientTimeline(data, client, propertyName = (id) => prName(data, id)) {
  if (!client) return [];
  const id = get(client, 'Client ID');
  return [
    ...data['Follow-ups']
      .filter((row) => get(row, 'Client ID') === id)
      .map((row) => ({
        date: get(row, 'Contact date'),
        title: get(row, 'Next action'),
        detail: get(row, 'Outcome / notes'),
        icon: 'chat',
      })),
    ...data.Viewings.filter((row) => get(row, 'Client ID') === id).map((row) => ({
      date: get(row, 'Appointment date & time'),
      title: 'Property viewing',
      detail: propertyName(get(row, 'Property ID')),
      icon: 'calendar',
    })),
  ]
    .sort((a, b) => dateNum(b.date) - dateNum(a.date))
    .slice(0, 5);
}
