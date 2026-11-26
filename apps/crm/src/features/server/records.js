import { blank, schema } from '../../lib/schema.js';
import {
  readDealLinks,
  readListingViewings,
  readReferences,
  readTaskClients,
} from './projections.js';
import { readKept } from './keptRecords.js';

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
export const assignableCollections = ['Clients', 'Properties', 'Contacts', 'Follow-ups'];
export const recordUnavailableMessage = 'This record is no longer available to you.';

/** Server metadata keys that must never enter or leave a workbook record payload. */
const reservedKeys = new Set([
  'assignee',
  'assigneeId',
  'assignee_id',
  'record_scope',
  'recordScope',
  'references',
  'taskClients',
  'listingViewings',
  'dealLinks',
]);
const incomplete = () => Error('The CRM server returned incomplete records.');
const invalid = () => Error('The CRM server returned invalid record information.');

export function readServerEntry(collection, row) {
  const identifier = schema(collection)[0].key;
  const assignee = row?.assignee;
  if (
    !row?.id ||
    !Number.isSafeInteger(row.version) ||
    row.version < 1 ||
    !row.record ||
    typeof row.record !== 'object' ||
    !row.record[identifier] ||
    !(assignee === null || (typeof assignee === 'string' && assignee)) ||
    (assignee && !assignableCollections.includes(collection))
  )
    throw invalid();
  const record = Object.fromEntries(
    Object.entries(row.record).filter(([key]) => !reservedKeys.has(key)),
  );
  return { id: row.id, version: row.version, record, assignee };
}

/**
 * Parses the scoped list response: visible entries plus read-only projections. Handed-over
 * rows the caller only keeps (agreements design §18) go to `keptEntries`, so counts,
 * pickers and recipients never treat them as the caller's own.
 */
export function readServerRecords(payload) {
  const entries = {};
  const keptEntries = {};
  const kept = readKept(payload?.kept);
  for (const collection of connectedCollections) {
    const rows = payload?.records?.[collection];
    if (!Array.isArray(rows)) throw incomplete();
    const keys = new Set();
    const identifier = schema(collection)[0].key;
    entries[collection] = rows.map((row) => {
      const entry = readServerEntry(collection, row);
      if (keys.has(entry.record[identifier])) throw invalid();
      keys.add(entry.record[identifier]);
      return entry;
    });
    keptEntries[collection] = entries[collection].filter((entry) => kept[entry.id]);
    entries[collection] = entries[collection].filter((entry) => !kept[entry.id]);
  }
  for (const key of ['scope', 'references', 'taskClients', 'listingViewings', 'dealLinks'])
    if (payload[key] === undefined) throw incomplete();
  if (!['team', 'assigned'].includes(payload.scope)) throw invalid();
  return {
    scope: payload.scope,
    entries,
    references: readReferences(payload.references),
    taskClients: readTaskClients(payload.taskClients),
    listingViewings: readListingViewings(payload.listingViewings),
    dealLinks: readDealLinks(payload.dealLinks),
    kept,
    keptEntries,
  };
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
  const entry = readServerEntry(collection, saved);
  const rows = entries[collection] || [];
  const found = rows.some((row) => row.id === entry.id);
  return {
    ...entries,
    [collection]: found ? rows.map((row) => (row.id === entry.id ? entry : row)) : [entry, ...rows],
  };
}

/** L5: a record that is hidden or gone is dropped locally without touching other entries. */
export function removeServerRecord(entries, collection, id) {
  const rows = entries[collection] || [];
  if (!rows.some((row) => row.id === id)) return entries;
  return { ...entries, [collection]: rows.filter((row) => row.id !== id) };
}

/** Applies a PUT assignee response; `entry: null` means the caller can no longer see it. */
export function applyAssigneeResult(entries, collection, id, result) {
  if (!result || typeof result !== 'object' || !('entry' in result)) throw invalid();
  if (result.entry === null) return removeServerRecord(entries, collection, id);
  if (result.entry.id !== id) throw invalid();
  return installServerRecord(entries, collection, result.entry);
}
