import { dayOf, dubaiToday } from '../../../lib/dubaiDate.js';
import { formatAed } from '../../../lib/finance/money.js';
import { get, isDone } from '../../../lib/records.js';

/** Up to four facts from a linked Client or Contact the viewer already loaded in scope. */
export function recordFacts(record) {
  const budget = Number(get(record, 'Maximum budget AED'));
  const looking = [get(record, 'Bedrooms'), get(record, 'Property type'), get(record, 'Buy / rent')]
    .filter(Boolean)
    .join(' · ');
  return [
    ['budget', budget > 0 ? formatAed(Math.round(budget * 100)) : ''],
    ['lookingFor', looking],
    ['areas', get(record, 'Preferred communities') || ''],
    ['source', get(record, 'Lead source') || ''],
  ].filter(([, value]) => value);
}

/**
 * The client's next open follow-ups and upcoming viewings, soonest first (at most three),
 * from records this session already loaded within its scope.
 */
export function comingUp(data, clientId, today = dubaiToday()) {
  const followUps = (data?.['Follow-ups'] || [])
    .filter((row) => get(row, 'Client ID') === clientId && !isDone(get(row, 'Task status')))
    .map((row) => ({
      kind: 'followUp',
      id: get(row, 'Activity ID'),
      title: get(row, 'Next action') || get(row, 'Outcome / notes') || '',
      when: dayOf(get(row, 'Due date')),
    }));
  const viewings = (data?.Viewings || [])
    .filter((row) => get(row, 'Client ID') === clientId)
    .map((row) => ({
      kind: 'viewing',
      id: get(row, 'Viewing ID'),
      title: get(row, 'Property title auto') || get(row, 'Property ID') || '',
      when: String(get(row, 'Appointment date & time') || ''),
    }))
    .filter((item) => dayOf(item.when) >= today);
  return [...followUps, ...viewings]
    .sort((a, b) => (a.when || '9999').localeCompare(b.when || '9999'))
    .slice(0, 3);
}
