/**
 * The approved mockup's CRM insights (design queue item 10), derived only from the scoped
 * records this session holds: where this month's leads came from, how viewings turn into
 * offers, how viewings move week on week and which clients have gone quiet.
 */
import { get, isDone, isLost } from '../../../lib/records.js';
import { addDays } from '../followUps/deadlineModel.js';
import { weekStart } from '../dashboard/kpiModel.js';

const text = (value) => String(value ?? '').trim();
const dayOf = (value) => /^(\d{4}-\d{2}-\d{2})/.exec(text(value))?.[1] || '';
const addedIn = (clients, month) =>
  (clients || []).filter((row) => dayOf(get(row, 'Date added')).slice(0, 7) === month);

/** This month's new leads by source, most first: `{ total, sources: [{ name, count }] }`. */
export function monthSources(clients, month) {
  const leads = addedIn(clients, month);
  const counts = new Map();
  for (const row of leads) {
    const source = text(get(row, 'Lead source'));
    if (source) counts.set(source, (counts.get(source) || 0) + 1);
  }
  const sources = [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { total: leads.length, sources };
}

/** Stages that mean a viewed client moved on to an offer. */
const offerStages = ['Negotiation', 'Documentation', 'Closed'];

/**
 * Viewings to offers: of the clients with a completed viewing, how many have since reached
 * Negotiation or later. `{ viewed, offers }`; "1 in N" is viewed ÷ offers.
 */
export function viewingsToOffers(data) {
  const viewed = new Set(
    (data.Viewings || [])
      .filter((row) => text(get(row, 'Viewing status')) === 'Completed')
      .map((row) => text(get(row, 'Client ID')))
      .filter(Boolean),
  );
  const offers = (data.Clients || []).filter(
    (row) =>
      viewed.has(text(get(row, 'Client ID'))) && offerStages.includes(text(get(row, 'Lead stage'))),
  ).length;
  return { viewed: viewed.size, offers };
}

/** Viewings booked this Monday–Sunday week and last, cancelled ones left out. */
export function viewingsWeekOnWeek(viewings, today) {
  const start = weekStart(today);
  const live = (viewings || []).filter((row) => !/cancel/i.test(text(get(row, 'Viewing status'))));
  const count = (from) =>
    live.filter((row) => {
      const day = dayOf(get(row, 'Appointment date & time'));
      return day >= from && day <= addDays(from, 6);
    }).length;
  return { thisWeek: count(start), lastWeek: count(addDays(start, -7)) };
}

/**
 * Open clients (not lost, closed or done) with no contact for `days` days: their latest
 * conversation, follow-up contact or client care contact is older, or they have none and were
 * added before then.
 */
export function quietClients(data, today, days = 30) {
  const since = addDays(today, -days);
  const latest = new Map();
  const note = (id, day) => {
    if (id && day && day > (latest.get(id) || '')) latest.set(id, day);
  };
  for (const row of data['Interaction log'] || [])
    note(text(get(row, 'Client ID')), dayOf(get(row, 'Contacted on UAE time')));
  for (const row of data['Follow-ups'] || [])
    note(text(get(row, 'Client ID')), dayOf(get(row, 'Contact date')));
  for (const row of data['Client care'] || [])
    note(text(get(row, 'Client ID')), dayOf(get(row, 'Last contact')));
  return (data.Clients || []).filter((row) => {
    const stage = text(get(row, 'Lead stage'));
    if (isLost(stage) || isDone(stage) || /closed/i.test(stage)) return false;
    const last = latest.get(text(get(row, 'Client ID')));
    return last ? last < since : (dayOf(get(row, 'Date added')) || today) < since;
  }).length;
}
