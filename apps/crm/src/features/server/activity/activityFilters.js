import { dubaiToday, shiftDay } from '../../../lib/dubaiDate.js';

/**
 * Activity filters (docs/team-activity-design.md): they live in the URL, use Dubai calendar days
 * and map onto the API's query. Any filter change starts again from the first page.
 */
export const filterKeys = ['from', 'to', 'member', 'type', 'section', 'action'];
export const emptyFilters = Object.fromEntries(filterKeys.map((key) => [key, '']));
export const DEFAULT_DAYS = 90;
export const MAX_DAYS = 366;
export const PAGE_SIZE = 50;

/** Today's Dubai calendar day as `YYYY-MM-DD`, and whole-day moves between such days. */
export { dubaiToday, shiftDay };

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

export function isDay(value) {
  if (!dayPattern.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/** Reads only well-formed values from the URL; anything else counts as not set. */
export function readFilters(search) {
  const params = new URLSearchParams(search);
  const value = (key) => (params.get(key) || '').trim();
  return {
    from: isDay(value('from')) ? value('from') : '',
    to: isDay(value('to')) ? value('to') : '',
    member: /^[0-9a-f-]{36}$/i.test(value('member')) ? value('member') : '',
    type: ['record', 'team', 'channel'].includes(value('type')) ? value('type') : '',
    section: value('section').slice(0, 40),
    action: /^[a-z_]{1,20}$/.test(value('action')) ? value('action') : '',
  };
}

/** The URL search after a filter change, keeping unrelated parameters such as `workspace`. */
export function writeFilters(search, filters) {
  const params = new URLSearchParams(search);
  for (const key of filterKeys) {
    if (filters[key]) params.set(key, filters[key]);
    else params.delete(key);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const filtersActive = (filters) => filterKeys.some((key) => Boolean(filters[key]));

/** The effective inclusive range: the last 90 Dubai days unless the URL names one. */
export function effectiveRange(filters, today = dubaiToday()) {
  const to = filters.to || (filters.from && filters.from > today ? filters.from : today);
  const from = filters.from || shiftDay(to, -(DEFAULT_DAYS - 1));
  return { from, to };
}

/** A plain-language problem with the chosen range, or '' when the server will accept it. */
export function rangeError(filters, today = dubaiToday()) {
  const { from, to } = effectiveRange(filters, today);
  if (to < from) return 'The end date must be on or after the start date.';
  if (daysBetween(from, to) + 1 > MAX_DAYS) return 'Choose a range of up to 366 days.';
  return '';
}

/**
 * API parameters for the first page. Staff never send a member or team type: the server would
 * refuse them, and their feed is always their own actions.
 */
export function requestParams(filters, { manager }, today = dubaiToday()) {
  const { from, to } = effectiveRange(filters, today);
  return {
    from,
    to,
    actor: manager ? filters.member : '',
    kind: manager ? filters.type : '',
    collection: ['team', 'channel'].includes(filters.type) ? '' : filters.section,
    action: filters.action,
    limit: PAGE_SIZE,
  };
}
