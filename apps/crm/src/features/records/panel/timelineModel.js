import { dateNum } from '../../../lib/dates.js';
import { get, prName } from '../../../lib/records.js';

const text = (value) => String(value ?? '').trim();
const joined = (...values) => values.map(text).filter(Boolean).join(' · ');
const property = (data, id) =>
  text(id) && Array.isArray(data?.Properties) ? prName(data, text(id)) : text(id);

/**
 * The client activity collections as timeline entries. Follow-ups and viewings read as in
 * the client desk timeline (`selectClientTimeline`); the interaction log and client care
 * add conversations and care touchpoints.
 */
const sources = [
  {
    module: 'Follow-ups',
    kind: 'followUp',
    icon: 'clock',
    id: 'Activity ID',
    read: (row) => ({
      date: get(row, 'Contact date') || get(row, 'Due date'),
      label: get(row, 'Channel'),
      title: get(row, 'Next action'),
      detail: get(row, 'Outcome / notes'),
      status: get(row, 'Task status'),
    }),
  },
  {
    module: 'Viewings',
    kind: 'viewing',
    icon: 'eye',
    id: 'Viewing ID',
    read: (row, data) => ({
      date: get(row, 'Appointment date & time'),
      title: property(data, get(row, 'Property ID')),
      detail: get(row, 'Client feedback'),
      status: get(row, 'Viewing status'),
    }),
  },
  {
    module: 'Interaction log',
    kind: 'interaction',
    icon: 'chat',
    id: 'Log ID',
    read: (row) => ({
      date: get(row, 'Contacted on UAE time'),
      label: joined(get(row, 'Channel'), get(row, 'Direction')),
      title: get(row, 'Conversation topic'),
      detail: get(row, 'Conversation summary / client needs'),
      status: get(row, 'Action status'),
    }),
  },
  {
    module: 'Client care',
    kind: 'care',
    icon: 'heart',
    id: 'Care ID',
    read: (row) => ({
      date: get(row, 'Last contact') || get(row, 'Next contact'),
      label: get(row, 'Touchpoint type'),
      title: get(row, 'Preferences / interests'),
      detail: get(row, 'Conversation notes'),
      status: get(row, 'Task status'),
    }),
  },
];

/** Collections the timeline reads; each still needs the viewer's module access. */
export const activityModules = sources.map((source) => source.module);

/**
 * One client's follow-ups, viewings, conversations and care entries from loaded records,
 * newest first, undated last. `canSee(module)` leaves out collections the viewer cannot
 * open. A client without an ID matches nothing, so blank links never gather strangers.
 */
export function selectRecordTimeline(data, client, canSee = () => true) {
  const clientId = text(get(client, 'Client ID'));
  if (!clientId) return [];
  return sources
    .filter((source) => canSee(source.module))
    .flatMap((source) =>
      (data?.[source.module] || [])
        .filter((row) => text(get(row, 'Client ID')) === clientId)
        .map((row, index) => {
          const entry = source.read(row, data);
          return {
            key: `${source.module}:${index}:${text(get(row, source.id))}`,
            module: source.module,
            kind: source.kind,
            icon: source.icon,
            date: text(entry.date),
            label: text(entry.label),
            title: text(entry.title),
            detail: text(entry.detail),
            status: text(entry.status),
          };
        }),
    )
    .sort((a, b) => dateNum(b.date) - dateNum(a.date));
}

/** The "HH:MM" of a date-and-time value ("…T17:00" or "… 17:00"), or '' for a plain date. */
export const timeOfDay = (value) =>
  /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/.exec(String(value ?? '').trim())?.[1] || '';
