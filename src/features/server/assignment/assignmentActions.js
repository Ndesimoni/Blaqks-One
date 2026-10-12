/**
 * Assignment mutations, kept free of React so they can be tested with mocked responses.
 * `records` is the connected records context; `view` provides setDetail and setToast.
 */
import {
  applyAssigneeResult,
  installServerRecord,
  recordUnavailableMessage,
  removeServerRecord,
} from '../records.js';
import { assignmentFailure } from './assignmentResponses.js';

const refreshQuietly = (records, view) =>
  records.refresh().catch(() => view.setToast('Reload the workspace to see the latest records.'));

/** PUT assignee; `entry: null` and 404 drop the record locally, then records are re-fetched (L5). */
export async function performAssignment({
  api,
  workspaceId,
  module,
  entry,
  toId,
  note,
  records,
  view,
}) {
  try {
    const result = await api.assign(workspaceId, module, entry, toId, note);
    // Validate against the current entries first, so a malformed payload becomes an error.
    applyAssigneeResult(records.entries, module, entry.id, result);
    records.setEntries((entries) => applyAssigneeResult(entries, module, entry.id, result));
    view.setDetail(result.entry ? { module, record: result.entry.record } : null);
    view.setToast(result.entry ? 'Assignment updated' : 'Record handed off. You no longer see it.');
    refreshQuietly(records, view);
    return { done: true };
  } catch (error) {
    if (error.status === 404) {
      records.setEntries((entries) => removeServerRecord(entries, module, entry.id));
      view.setDetail(null);
      view.setToast(recordUnavailableMessage);
      return { done: true };
    }
    if (error.status === 409) refreshQuietly(records, view);
    return { message: assignmentFailure(error) };
  }
}

const installAll = (entries, collection, saved) =>
  saved.reduce((next, entry) => installServerRecord(next, collection, entry), entries);

/** POST bulk: all-or-nothing, so a failure changes nothing locally except a refresh. */
export async function performBulk({
  api,
  workspaceId,
  collection,
  targets,
  toId,
  note,
  records,
  view,
}) {
  try {
    const result = await api.bulkAssign(workspaceId, toId, targets, note);
    if (!Array.isArray(result?.entries) || result.entries.length !== targets.length)
      throw Error('The CRM server returned invalid assignment information.');
    installAll(records.entries, collection, result.entries);
    records.setEntries((entries) => installAll(entries, collection, result.entries));
    view.setToast(`${targets.length} ${targets.length === 1 ? 'record' : 'records'} reassigned`);
    refreshQuietly(records, view);
    return { done: true };
  } catch (error) {
    if ([404, 409].includes(error.status)) refreshQuietly(records, view);
    return { message: assignmentFailure(error, true) };
  }
}
