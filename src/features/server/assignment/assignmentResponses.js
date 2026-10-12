/** Defensive readers for the assignment endpoints (contract §6, M4, M5). */
const invalid = () => Error('The CRM server returned invalid assignment information.');

export const reasonLabels = {
  created: 'Assigned when created',
  backfill: 'Assigned when assignments began',
  reassigned: 'Reassigned',
  bulk: 'Bulk reassignment',
  departure: 'Released when a member left',
  access_removed: 'Released after an access change',
  import: 'Assigned on import',
  admin_reassigned: 'Reassigned by Admin',
};

const text = (value, required = true) => {
  if (!required && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || (required && !value.trim())) throw invalid();
  return value;
};

function person(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return { id: text(value.id), name: text(value.name, false) || 'Team member' };
}

export function readAssignees(payload) {
  if (!Array.isArray(payload?.assignees)) throw invalid();
  const seen = new Set();
  return payload.assignees.map((row) => {
    const found = person(row);
    if (!found || seen.has(found.id)) throw invalid();
    seen.add(found.id);
    return found;
  });
}

export function readAssignmentHistory(payload) {
  if (!Array.isArray(payload?.history)) throw invalid();
  return payload.history.map((row) => {
    if (!row || typeof row !== 'object' || !reasonLabels[row.reason]) throw invalid();
    const note = text(row.note, false);
    if (note !== null && note.length > 1000) throw invalid();
    return {
      at: text(row.at),
      reason: row.reason,
      from: person(row.from),
      to: person(row.to),
      actor: person(row.actor),
      note,
    };
  });
}

export function historyDate(at) {
  const date = new Date(at);
  if (Number.isNaN(date.valueOf())) return at;
  return date.toLocaleString('en-AE', {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Raw `appointment_date_time` (timezone normalisation is deferred to P10). */
export function viewingTime(value) {
  if (!value) return 'Time not set';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  const label = date.toLocaleDateString('en-AE', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return hour ? `${label} · ${hour}:${minute}` : label;
}

/** Plain-language failures for one record or an all-or-nothing batch. */
export function assignmentFailure(error, bulk = false) {
  const prefix = bulk ? 'No records were changed. ' : '';
  if (error.status === 409 && error.details?.code === 'version_conflict')
    return `${prefix}${bulk ? 'A record' : 'This record'} changed since it was loaded. The list has been refreshed; try again.`;
  if (bulk && error.status === 404)
    return `${prefix}At least one record is no longer available. The list has been refreshed.`;
  return `${prefix}${error.message || 'The assignment could not be saved.'}`;
}
