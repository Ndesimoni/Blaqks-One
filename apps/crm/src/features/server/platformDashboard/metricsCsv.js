import { csvLine } from '../../../lib/csv.js';
import { figureSections } from './figureSections.js';
import { csvValue } from './metricsFormat.js';
import { TREND_SERIES } from './metricsModel.js';

/**
 * The investor-pack CSV (BO1d): the period, every figure on the dashboard with what it covers,
 * the twelve-month trends and each company's usage (never money). Money is AED with two
 * decimals so a spreadsheet can sum it; untracked figures say so instead of reading zero.
 */
const UNITS = { money: 'AED', days: 'days' };
const MONEY_SERIES = (key) => key.endsWith('Fils');

export const metricsCsvName = (period, day) => `Blaqks_One_metrics_${period}_${day}.csv`;

function figureLines(metrics, t, f) {
  const today = f('csvToday');
  const during = t(`platformMetrics.period.${metrics.period.key}`);
  return [
    csvLine([f('csvSection'), f('csvFigure'), f('csvCovers'), f('csvValue'), f('csvUnit')]),
    ...figureSections.flatMap((section) =>
      section.rows.map((row) =>
        csvLine([
          f(`section.${section.key}`),
          f(row.key),
          row.period ? during : today,
          csvValue(row.kind, row.read(metrics), t),
          UNITS[row.kind] ?? '',
        ]),
      ),
    ),
  ];
}

function trendLines(trends, t, f) {
  const label = (key) => f(`series.${key}`) + (MONEY_SERIES(key) ? ' (AED)' : '');
  return [
    csvLine([f('csvMonth'), ...TREND_SERIES.map(label)]),
    ...trends.months.map((month, index) =>
      csvLine([
        month,
        ...TREND_SERIES.map((key) =>
          csvValue(MONEY_SERIES(key) ? 'money' : 'count', trends[key][index], t),
        ),
      ]),
    ),
  ];
}

function companyLines(companies, t, f) {
  const columns = ['company', 'admin', 'joined', 'status', 'seatsUsed', 'seatLimit'];
  return [
    csvLine([...columns, 'activeUsers', 'lastActive', 'records'].map((key) => f(`csv.${key}`))),
    ...companies.map((row) =>
      csvLine([
        row.name,
        row.admin ?? '',
        row.createdOn ?? '',
        t(`platformCompanies.status.${row.status}`) || row.status,
        csvValue('count', row.seatsUsed, t),
        row.seatLimit === null ? f('noLimit') : String(row.seatLimit),
        csvValue('count', row.activeUsers30d, t),
        row.lastActiveAt ?? '',
        csvValue('count', row.records, t),
      ]),
    ),
  ];
}

/** The whole CSV as text; `t` is the English translator. */
export function metricsCsv(metrics, t) {
  const f = (key, vars) => t(`platformFigures.${key}`, vars);
  const { key, from, to } = metrics.period;
  return [
    csvLine([f('csvTitle')]),
    csvLine([f('csvPeriod'), t(`platformMetrics.period.${key}`), from ?? '', to ?? '']),
    csvLine([f('csvGenerated'), metrics.generatedAt]),
    '',
    ...figureLines(metrics, t, f),
    '',
    ...trendLines(metrics.trends, t, f),
    '',
    ...companyLines(metrics.companies, t, f),
  ].join('\n');
}
