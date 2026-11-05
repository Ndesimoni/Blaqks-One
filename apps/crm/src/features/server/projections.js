/**
 * Read-only projections returned beside the visible records (assignments contract §3, §6).
 * Only the allowed fields are kept, so anything extra the server might send never reaches the UI.
 * References and task clients are display labels only; they are never offered as link options.
 */
const invalid = () => Error('The CRM server returned invalid record information.');

const referenceShapes = {
  Clients: ['client_id', 'full_name'],
  Properties: ['property_id', 'listing_title'],
  Contacts: ['contact_id', 'full_name'],
};
export const referenceCollections = Object.keys(referenceShapes);

function text(value, { required = false, max = 2000 } = {}) {
  if (value === null || value === undefined) {
    if (required) throw invalid();
    return null;
  }
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw invalid();
  return value;
}

function list(value) {
  if (!Array.isArray(value)) throw invalid();
  return value;
}

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value;
}

export function readReferences(value) {
  const source = object(value);
  return Object.fromEntries(
    referenceCollections.map((collection) => {
      const [idKey, nameKey] = referenceShapes[collection];
      const rows = list(source[collection] ?? []).map((row) => ({
        [idKey]: text(object(row)[idKey], { required: true }),
        [nameKey]: text(row[nameKey]),
      }));
      return [collection, rows];
    }),
  );
}

export function readTaskClients(value) {
  return list(value).map((row) => ({
    client_id: text(object(row).client_id, { required: true }),
    full_name: text(row.full_name),
    phone: text(row.phone),
    email: text(row.email),
  }));
}

export function readListingViewings(value) {
  return list(value).map((row) => {
    const agent = object(row).agent;
    return {
      property_id: text(row.property_id, { required: true }),
      appointment_date_time: text(row.appointment_date_time, { max: 64 }),
      agent:
        agent === null || agent === undefined
          ? null
          : { id: text(object(agent).id, { required: true }), name: text(agent.name) || '' },
    };
  });
}

/**
 * `dealLinks` (finance-design §17.7): visible Interaction logs whose stored link names a deal
 * the caller can see. A log appears at most once; no other deal data travels with it.
 */
export function readDealLinks(value) {
  const logs = new Set();
  return list(value).map((row) => {
    const link = {
      log_id: text(object(row).log_id, { required: true, max: 128 }),
      deal_id: text(row.deal_id, { required: true, max: 128 }),
    };
    if (logs.has(link.log_id)) throw invalid();
    logs.add(link.log_id);
    return link;
  });
}

/** The visible deal a log links to, or null ("Linked deal unavailable" when text is stored). */
export function linkedDeal(projections, logId, value) {
  if (!logId || !value) return null;
  const found = projections.dealLinks?.find((row) => row.log_id === logId);
  return found?.deal_id === value ? found.deal_id : null;
}

export const emptyProjections = Object.freeze({
  scope: null,
  references: Object.freeze({ Clients: [], Properties: [], Contacts: [] }),
  taskClients: Object.freeze([]),
  listingViewings: Object.freeze([]),
  dealLinks: Object.freeze([]),
  kept: Object.freeze({}),
  keptEntries: Object.freeze({}),
});

/**
 * Label for a linked ID the caller cannot open. `taskClient` marks a client shown only because a
 * follow-up is directly assigned to the caller; only that client's holder may change the link.
 */
export function linkReference(projections, collection, id) {
  if (!id || !referenceShapes[collection]) return null;
  const [idKey, nameKey] = referenceShapes[collection];
  const task =
    collection === 'Clients' && projections.taskClients.find((row) => row.client_id === id);
  const found = task || projections.references[collection]?.find((row) => row[idKey] === id);
  if (!found) return null;
  const name = found[nameKey];
  return {
    label: `${id}${name ? ` · ${name}` : ''} (not assigned to you)`,
    taskClient: Boolean(task),
  };
}
