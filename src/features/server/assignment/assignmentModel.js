/** Pure assignment rules for connected records (assignments contract §1, §5, §8). */
import { schema } from '../../../lib/schema.js';

export const queueCollections = ['Clients', 'Properties', 'Contacts'];
export const assignmentCollections = [...queueCollections, 'Follow-ups'];
export const queueLabel = 'Unassigned · needs owner';
export const noteLimit = 1000;
export const bulkLimit = 500;

export const isAssignable = (collection) => assignmentCollections.includes(collection);

const key = (collection) => schema(collection)[0].key;

export function findEntry(entries, collection, record) {
  const id = key(collection);
  return entries[collection]?.find((entry) => entry.record[id] === record?.[id]) || null;
}

/** Holder: the assignee; a Follow-up without one inherits its linked client's holder. */
export function effectiveHolder(entries, collection, entry) {
  if (!entry) return null;
  if (collection !== 'Follow-ups' || entry.assignee) return entry.assignee;
  const clientId = entry.record.client_id;
  if (!clientId) return null;
  return entries.Clients?.find((row) => row.record.client_id === clientId)?.assignee ?? null;
}

/** Whether the caller keeps sight of a record through its parent after handing it off. */
export function inheritedVisibility(entries, collection, record, me) {
  if (collection === 'Follow-ups' && record.client_id)
    return (entries.Clients || []).some(
      (row) => row.record.client_id === record.client_id && row.assignee === me,
    );
  if (collection === 'Contacts' && record.contact_id)
    return (entries.Properties || []).some(
      (row) => row.record.contact_id === record.contact_id && row.assignee === me,
    );
  return false;
}

/** Reassigning requires being the holder or having team scope (§5). */
export function canReassign(scope, holderId, me) {
  return scope === 'team' || (Boolean(me) && holderId === me);
}

/** Assigned-only callers lose a record they pass on unless a held parent still shows it. */
export function losesVisibility({ scope, me, toId, inherited = false }) {
  return scope !== 'team' && toId !== me && !inherited;
}

export function personName(people, id, me) {
  if (!id) return '';
  if (id === me) return 'You';
  return people.find((person) => person.id === id)?.name || 'Team member';
}

export function assigneeLabel(collection, assigneeId, people, me) {
  if (assigneeId) return personName(people, assigneeId, me);
  return collection === 'Follow-ups' ? 'No direct assignee' : queueLabel;
}

export function noteError(note) {
  return note.trim().length > noteLimit ? `Keep the note to ${noteLimit} characters or fewer.` : '';
}

/** "Assigned to" filter values: '' (Everyone), 'queue', or a member UUID. */
export function matchesAssignedTo(filter, holderId) {
  if (!filter) return true;
  if (filter === 'queue') return !holderId;
  return holderId === filter;
}

export function filterAssignedEntries(entries, collection, filter) {
  return (entries[collection] || []).filter((entry) =>
    matchesAssignedTo(filter, effectiveHolder(entries, collection, entry)),
  );
}

/** The records a bulk reassignment sends: identity and version only, capped by the contract. */
export function bulkTargets(entries, collection, filter) {
  const rows = filterAssignedEntries(entries, collection, filter);
  return {
    records: rows.map(({ id, version }) => ({ collection, id, version })),
    tooMany: rows.length > bulkLimit,
  };
}

export function assignedToLabel(filter, people, me) {
  if (!filter) return 'Everyone';
  if (filter === 'queue') return queueLabel;
  return personName(people, filter, me);
}
