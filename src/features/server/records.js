import { blank, schema } from '../../lib/schema.js';

export const connectedCollections = [
  'Clients',
  'Contacts',
  'Properties',
  'Follow-ups',
  'Viewings',
  'Shortlist',
  'Interaction log',
  'Client care',
];

export function readServerRecords(payload) {
  const entries = {};
  for (const collection of connectedCollections) {
    const rows = payload?.records?.[collection];
    if (!Array.isArray(rows)) throw Error('The CRM server returned incomplete records.');
    const keys = new Set();
    const identifier = schema(collection)[0].key;
    entries[collection] = rows.map((row) => {
      if (
        !row?.id ||
        !Number.isSafeInteger(row.version) ||
        row.version < 1 ||
        !row.record?.[identifier] ||
        keys.has(row.record[identifier])
      )
        throw Error('The CRM server returned invalid record information.');
      keys.add(row.record[identifier]);
      return { id: row.id, version: row.version, record: row.record };
    });
  }
  return entries;
}

export function serverWorkspaceData(entries) {
  return {
    ...blank(),
    ...Object.fromEntries(
      connectedCollections.map((name) => [
        name,
        (entries[name] || []).map((entry) => entry.record),
      ]),
    ),
  };
}

export function serverRecordMetadata(entries, collection, record) {
  const key = schema(collection)[0].key;
  const found = entries[collection]?.find((entry) => entry.record[key] === record[key]);
  if (!found) throw Error('This record is no longer available. Reload your workspace.');
  return { id: found.id, version: found.version };
}

export function installServerRecord(entries, collection, saved) {
  readServerRecords({ records: { ...entries, [collection]: [saved] } });
  const found = entries[collection].some((row) => row.id === saved.id);
  return {
    ...entries,
    [collection]: found
      ? entries[collection].map((row) => (row.id === saved.id ? saved : row))
      : [saved, ...entries[collection]],
  };
}
