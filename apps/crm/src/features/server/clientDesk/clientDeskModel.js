import { get } from '../../../lib/records.js';

/**
 * Contact-only clients for the connected Client desk: clients reached only through a follow-up
 * assigned to the member. A client the member can already open is shown in full elsewhere, so it
 * is left out here. Search covers only the permitted name, phone, email and ID.
 */
export function selectTaskClients(taskClients = [], visibleClients = [], query = '') {
  const visible = new Set(visibleClients.map((client) => client.client_id));
  const search = query.trim().toLowerCase();
  return taskClients.filter(
    (client) =>
      !visible.has(client.client_id) &&
      (!search ||
        [client.client_id, client.full_name, client.phone, client.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search)),
  );
}

const text = (value) => String(value ?? '').trim();

/**
 * What a client is looking for, as the approved mockup's desk reads it: size or type, areas,
 * then buy or rent ("2-bed, Dubai Marina, JBR, rent"). '' when nothing is set.
 */
export function clientNeed(client) {
  const beds = text(get(client, 'Bedrooms'));
  const size = /^0$|studio/i.test(beds) ? 'Studio' : beds ? `${beds}-bed` : '';
  return [
    size || text(get(client, 'Property type')),
    text(get(client, 'Preferred communities')),
    text(get(client, 'Buy / rent')).toLowerCase(),
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Why a listing matches a client (the desk's reason pills): the purpose, the price against the
 * budget ("Within budget", or "5% over budget" up to the 8% the match allows) and the area.
 * Each is `{ tone: 'green' | 'amber', text }`.
 */
export function matchReasons(client, property) {
  const reasons = [];
  const purpose = text(get(client, 'Buy / rent'));
  if (purpose) reasons.push({ tone: 'green', text: purpose });
  const budget = Number(get(client, 'Maximum budget AED')) || 0;
  const price = Number(get(property, 'Price / annual rent AED')) || 0;
  if (budget && price) {
    const over = Math.ceil((price / budget - 1) * 100);
    reasons.push(
      over > 0
        ? { tone: 'amber', text: `${over}% over budget` }
        : { tone: 'green', text: 'Within budget' },
    );
  }
  const area = text(get(property, 'Community'));
  if (area && text(get(client, 'Preferred communities')))
    reasons.push({ tone: 'green', text: area });
  return reasons;
}
