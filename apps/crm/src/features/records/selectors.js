import { isDue, leadTier } from '../../lib/crm.js';
import { get, isDone, isLost } from '../../lib/records.js';
import { dateNum, today } from '../../lib/dates.js';
import { dubaiToday } from '../../lib/dubaiDate.js';

/**
 * Each directory's filter presets; the first is the default, shown as the grid's pill. The
 * approved mockup's presets lead and the earlier ones follow, so no filter is lost (owner,
 * 2026-11-01).
 */
export const recordTabs = (module) =>
  ({
    Clients: ['All clients', 'Buyers', 'Tenants', 'Hot leads', 'Closed', 'Lost'],
    Shortlist: ['Active shortlists', 'All shortlists'],
    'Client care': ['Due this month', 'Birthdays', 'Renewals', 'All client care'],
    'Interaction log': ['Everything'],
    Deals: ['All', 'Open', 'Completed', 'Lost'],
    'Follow-ups': ['All', 'Overdue', 'Open', 'Completed'],
    Viewings: ['All', 'Upcoming', 'Completed'],
  })[module] || ['All'];

/** The view resets its tab to 'All' on every page; a preset this page lacks means its first. */
export const activeTab = (tabs, tab) => (tabs.includes(tab) ? tab : tabs[0]);

/** The last Dubai calendar day of the month `day` falls in. */
function monthEnd(day) {
  const [year, month] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Open touchpoints due by the end of this month; overdue ones stay in view until done. */
function dueThisMonth(record) {
  const next = String(get(record, 'Next contact') || '').slice(0, 10);
  return Boolean(next) && next <= monthEnd(dubaiToday()) && !isDone(get(record, 'Task status'));
}

const presetMatchers = {
  Clients: {
    Buyers: (record) => get(record, 'Buy / rent') === 'Buy',
    Tenants: (record) => get(record, 'Buy / rent') === 'Rent',
    'Hot leads': (record) => leadTier(record) === 'Hot',
    Closed: (record) => /closed/i.test(String(get(record, 'Lead stage') || '')),
    Lost: (record) => leadTier(record) === 'Lost',
  },
  Shortlist: {
    'Active shortlists': (record) => get(record, 'Client response') !== 'Not interested',
  },
  'Client care': {
    'Due this month': dueThisMonth,
    Birthdays: (record) => get(record, 'Touchpoint type') === 'Birthday / milestone',
    Renewals: (record) => get(record, 'Touchpoint type') === 'Lease renewal',
  },
};

export function matchesRecordTab(module, record, tab) {
  if (tab === 'All') return true;
  const preset = presetMatchers[module]?.[tab];
  if (preset) return preset(record);
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
