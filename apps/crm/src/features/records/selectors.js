import { isDue, leadTier } from '../../lib/crm.js';
import { get, isDone, isLost } from '../../lib/records.js';
import { dateNum, today } from '../../lib/dates.js';

export const recordTabs = (module) =>
  ({
    Clients: ['All', 'Hot leads', 'Closed', 'Lost'],
    Deals: ['All', 'Open', 'Completed', 'Lost'],
    'Follow-ups': ['All', 'Overdue', 'Open', 'Completed'],
    Viewings: ['All', 'Upcoming', 'Completed'],
  })[module] || ['All'];

export function matchesRecordTab(module, record, tab) {
  if (tab === 'All') return true;
  if (module === 'Clients')
    return tab === 'Hot leads'
      ? leadTier(record) === 'Hot'
      : tab === 'Closed'
        ? /closed/i.test(String(get(record, 'Lead stage') || ''))
        : tab === 'Lost'
          ? leadTier(record) === 'Lost'
          : true;
  if (module === 'Deals')
    return tab === 'Open'
      ? !isDone(get(record, 'Deal stage'))
      : tab === 'Completed'
        ? /completed/i.test(String(get(record, 'Deal stage')))
        : isLost(get(record, 'Deal stage'));
  if (module === 'Follow-ups')
    return tab === 'Overdue'
      ? isDue(record)
      : tab === 'Open'
        ? !isDone(get(record, 'Task status'))
        : isDone(get(record, 'Task status'));
  if (module === 'Viewings')
    return tab === 'Upcoming'
      ? dateNum(get(record, 'Appointment date & time')) >= dateNum(today())
      : tab === 'Completed'
        ? get(record, 'Viewing status') === 'Completed'
        : true;
  return true;
}
