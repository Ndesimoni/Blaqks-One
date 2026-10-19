/**
 * Language-aware display formatting (docs/i18n.md). Dates and times follow the Asia/Dubai
 * business calendar. Arabic uses Western digits. Money stays in whole fils: the exact decimal
 * text from the fils-safe helpers is passed to Intl, never a float, and English money and
 * percentages reuse `formatAed`/`formatPercent` so existing outputs do not change.
 */
import { DUBAI_TIME_ZONE } from '../lib/dubaiDate.js';
import { bpToPercent, filsToAed, formatAed, formatPercent } from '../lib/finance/money.js';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages.js';

const DASH = '—';
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const cache = new Map();

function formatter(kind, locale, options) {
  const id = `${kind}|${locale}|${JSON.stringify(options)}`;
  if (!cache.has(id)) {
    const Format = kind === 'date' ? Intl.DateTimeFormat : Intl.NumberFormat;
    cache.set(id, new Format(locale, options));
  }
  return cache.get(id);
}

/** A Date for a `YYYY-MM-DD` Dubai day (noon, so no zone shift), a timestamp or a Date. */
function instant(value) {
  if (value === null || value === undefined || value === '') return null;
  const date =
    typeof value === 'string' && DAY_ONLY.test(value)
      ? new Date(`${value}T12:00:00+04:00`)
      : value instanceof Date
        ? value
        : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const asWholeFils = (fils) =>
  typeof fils === 'bigint' || Number.isSafeInteger(fils) ? filsToAed(fils) : null;

/** Formatters for one language; missing or invalid values show a dash. */
export function createFormatters(language) {
  const { locale } = LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE];
  const english = (LANGUAGES[language] ?? LANGUAGES.en).code === DEFAULT_LANGUAGE;
  const date = (value, options = { dateStyle: 'medium' }) => {
    const at = instant(value);
    return at
      ? formatter('date', locale, { timeZone: DUBAI_TIME_ZONE, ...options }).format(at)
      : DASH;
  };
  return {
    locale,
    date,
    /** 24-hour Dubai wall-clock time, matching the existing English "14:05". */
    time: (value) => date(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    dateTime: (value) => date(value, { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }),
    number(value, options = {}) {
      if (typeof value !== 'number' && typeof value !== 'bigint') return DASH;
      return Number.isFinite(Number(value))
        ? formatter('number', locale, options).format(value)
        : DASH;
    },
    /** Basis points (10000 = 100%) to a percentage with up to two decimals. */
    percent(bp) {
      if (bp === null || bp === undefined) return DASH;
      if (english) return formatPercent(bp);
      const options = { style: 'percent', maximumFractionDigits: 2 };
      return formatter('number', locale, options).format(`${bpToPercent(bp)}e-2`);
    },
    /** Whole fils to AED with two decimals; English is exactly `formatAed`. */
    money(fils) {
      if (fils === null || fils === undefined) return DASH;
      if (english) return formatAed(fils);
      const exact = asWholeFils(fils);
      if (exact === null) return DASH;
      const options = { style: 'currency', currency: 'AED', minimumFractionDigits: 2 };
      return formatter('number', locale, options).format(exact);
    },
  };
}
