/**
 * Connected Dashboard "Upcoming viewings" rules. The caller's own visible viewings are merged with
 * the `listingViewings` projection (decision 6, extended 2026-10-15): other agents' viewings on a
 * listing the caller holds. Those entries carry only the time, the property and the responsible
 * agent, and nothing that could open or fetch the viewing.
 */
import { dateNum, today } from '../../../lib/dates.js';
import { get } from '../../../lib/records.js';

export const upcomingLimit = 3;

/**
 * The projection concerns listings the caller holds, so it belongs only in the caller's own view:
 * the unfiltered dashboard or a workload filter set to the caller.
 */
export const showsListingViewings = (filter, me) => !filter || filter === me;

/** "HH:MM" from a stored appointment, or a plain label when no time was recorded. */
export function viewingClock(value) {
  const match = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/.exec(String(value || ''));
  return match ? `${match[1]}:${match[2]}` : 'Time not set';
}

/** Only the permitted fields, so nothing else from the projection can reach the panel. */
function heldEntry(item) {
  return {
    kind: 'held',
    at: item.appointment_date_time,
    propertyId: item.property_id,
    agentName: item.agent ? item.agent.name : null,
  };
}

/**
 * Own upcoming viewings (already windowed and sorted by the summary) plus held-listing entries in
 * the same window, merged by appointment time. Ties keep own viewings first, then server order.
 */
export function upcomingEntries(upcoming, listingViewings, include, limit = upcomingLimit) {
  const own = upcoming.map((record) => ({
    kind: 'own',
    at: get(record, 'Appointment date & time'),
    record,
  }));
  const start = dateNum(today());
  const held = include
    ? (listingViewings || [])
        .filter((item) => dateNum(item.appointment_date_time) >= start)
        .map(heldEntry)
    : [];
  return [...own, ...held].sort((a, b) => dateNum(a.at) - dateNum(b.at)).slice(0, limit);
}
