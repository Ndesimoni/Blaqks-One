import { filsToAed } from '../../../lib/finance/money.js';
import { compactAed } from '../dashboard/kpiModel.js';

/**
 * How a platform figure reads. Money arrives as whole fils and is formatted with the shared
 * fils-safe helpers; a null figure is "not tracked yet" and is never shown as zero.
 */
const untracked = (value) => value === null || value === undefined;
const isLive = (value) => value === true || value > 0;

/** Minutes under an hour, then hours to one decimal ("2.5 hours"). */
const minutesText = (minutes, t) =>
  minutes < 60
    ? t('platformFigures.minutes', { count: minutes })
    : t('platformFigures.hours', { count: Math.round(minutes / 6) / 10 });

/** On-screen text for a figure of `kind`, or null when it is not tracked yet. */
export function figureText(kind, value, { t, format }) {
  if (untracked(value)) return null;
  if (kind === 'money') return format.money(value);
  if (kind === 'flag') return t(isLive(value) ? 'platformFigures.live' : 'platformFigures.notLive');
  if (kind === 'days') return t('platformFigures.days', { count: value });
  if (kind === 'minutes') return minutesText(value, t);
  return format.number(value);
}

/** Compact AED for tiles and chart axes ("AED 12.4M"), or null when untracked. */
export const compactMoney = (fils) => (untracked(fils) ? null : compactAed(fils));

/** CSV text: plain digits and AED decimals a spreadsheet can sum; untracked says so. */
export function csvValue(kind, value, t) {
  if (untracked(value)) return t('platformFigures.notTracked');
  if (kind === 'money') return filsToAed(value);
  if (kind === 'flag') return t(isLive(value) ? 'platformFigures.live' : 'platformFigures.notLive');
  return String(value);
}
