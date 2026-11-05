import { SOURCES, STAGES, TIMELINE_KINDS } from './clientsModel.js';

/**
 * Checks what the clients API returns before the screen shows it (BO1e). A response missing
 * an identity, version, stage or list throws, so the page shows its error state rather than a
 * half-drawn client; optional text arrives as ''.
 */
const incomplete = () => {
  throw Error('The client list was incomplete. Please try again.');
};
const id = (value) => (typeof value === 'string' && value ? value : incomplete());
const text = (value) => (typeof value === 'string' ? value : '');
const day = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value : '');

function linked(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') incomplete();
  return { id: id(value.id), name: text(value.name) };
}

/** One client as the list and the slider use it. */
export function readClient(value) {
  if (!value || typeof value !== 'object') incomplete();
  if (!STAGES.includes(value.stage)) incomplete();
  if (!Number.isInteger(value.version)) incomplete();
  return {
    id: id(value.id),
    companyName: text(value.companyName),
    contactName: text(value.contactName),
    phone: text(value.phone),
    email: text(value.email),
    source: SOURCES.includes(value.source) ? value.source : 'other',
    stage: value.stage,
    nextFollowUp: day(value.nextFollowUp).slice(0, 10),
    ownerId: text(value.ownerId),
    ownerName: text(value.ownerName),
    linkedCompany: linked(value.linkedCompany),
    notes: text(value.notes),
    createdAt: text(value.createdAt),
    createdByName: text(value.createdByName),
    updatedAt: text(value.updatedAt),
    version: value.version,
  };
}

/** `{ clients, stageCounts, nextCursor }`; counts missing a stage read as 0. */
export function readClientList(value) {
  if (!Array.isArray(value?.clients)) incomplete();
  const counts =
    value.stageCounts && typeof value.stageCounts === 'object' ? value.stageCounts : {};
  return {
    clients: value.clients.map(readClient),
    stageCounts: Object.fromEntries(
      STAGES.map((stage) => [stage, Number.isInteger(counts[stage]) ? counts[stage] : 0]),
    ),
    nextCursor: typeof value.nextCursor === 'string' && value.nextCursor ? value.nextCursor : null,
  };
}

/** One timeline entry; an unknown kind reads as a note so nothing logged is ever hidden. */
export function readEntry(value) {
  if (!value || typeof value !== 'object') incomplete();
  return {
    id: id(value.id),
    kind: TIMELINE_KINDS.includes(value.kind) ? value.kind : 'note',
    body: text(value.body),
    authorName: text(value.authorName),
    at: text(value.at),
  };
}

/** `{ client, timeline }`, the timeline newest first whatever order it arrives in. */
export function readClientDetail(value) {
  if (!Array.isArray(value?.timeline)) incomplete();
  const timeline = value.timeline.map(readEntry);
  timeline.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  return { client: readClient(value.client), timeline };
}

/** The team members a client can be assigned to. */
export function readOwners(value) {
  if (!Array.isArray(value?.owners)) incomplete();
  return value.owners.map((owner) => ({ id: id(owner?.id), name: text(owner?.name) }));
}
