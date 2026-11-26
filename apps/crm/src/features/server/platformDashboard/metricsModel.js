import { FIGURE, FLAG, RECORD_TYPES, SHAPE, TREND_SERIES } from './metricsShape.js';

/**
 * Reading the platform figures (BO1d, docs/blaqks-one-console.md §3 item 4). Every figure is a
 * whole count, whole fils or null for "not tracked yet"; a reply missing any part is refused
 * with a clear message rather than shown as zeros. Company rows carry usage only, never money.
 */
export const PERIODS = ['30d', '12m', 'all'];
export const DEFAULT_PERIOD = '30d';
export { RECORD_TYPES, TREND_SERIES };
export const INCOMPLETE = 'The platform figures were incomplete. Please try again.';

/** A figure: null (not tracked yet), or a whole number; only a median may have a fraction. */
export function isFigure(key, value) {
  if (value === null) return true;
  if (key.startsWith('median')) return Number.isFinite(value) && value >= 0;
  return Number.isSafeInteger(value) && value >= 0;
}

function conforms(shape, value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(shape).every(([key, kind]) => {
    if (!Object.hasOwn(value, key)) return false;
    const item = value[key];
    if (kind === FLAG) return typeof item === 'boolean' || isFigure(key, item);
    return kind === FIGURE ? isFigure(key, item) : conforms(kind, item);
  });
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const text = (value) => typeof value === 'string';
const textOrNull = (value) => value === null || text(value);

function trendsConform(trends) {
  const months = trends?.months;
  if (!Array.isArray(months) || months.length !== 12 || !months.every((m) => MONTH.test(m)))
    return false;
  return TREND_SERIES.every((key) => {
    const values = trends[key];
    return Array.isArray(values) && values.length === 12 && values.every((v) => isFigure(key, v));
  });
}

const companyConforms = (row) =>
  text(row?.id) &&
  row.id !== '' &&
  text(row.name) &&
  textOrNull(row.admin) &&
  textOrNull(row.createdOn) &&
  text(row.status) &&
  textOrNull(row.lastActiveAt) &&
  ['seatsUsed', 'seatLimit', 'activeUsers30d', 'records'].every((key) => isFigure(key, row[key]));

/** The reply as the dashboard reads it, or an Error naming the problem in plain words. */
export function readPlatformMetrics(value) {
  const complete =
    text(value?.generatedAt) &&
    PERIODS.includes(value?.period?.key) &&
    conforms(SHAPE, value) &&
    trendsConform(value.trends) &&
    Array.isArray(value.companies) &&
    value.companies.every(companyConforms);
  if (!complete) throw Error(INCOMPLETE);
  return value;
}

/** Websites live: company sites plus the general site; null while either is untracked. */
export function websitesLive({ companySitesLive, generalSiteLive }) {
  if (companySitesLive === null || generalSiteLive === null) return null;
  return companySitesLive + (generalSiteLive === true || generalSiteLive > 0 ? 1 : 0);
}

/** A series' total over its months, ignoring untracked months; null when none is tracked. */
export function seriesTotal(values) {
  const tracked = values.filter((value) => value !== null);
  return tracked.length ? tracked.reduce((sum, value) => sum + value, 0) : null;
}
