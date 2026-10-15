import React from 'react';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { formatFigure } from './targetsModel.js';

const short = (month) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('en-AE', { month: 'short' });
const long = (month) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('en-AE', { month: 'long', year: 'numeric' });

/**
 * Twelve-month bars: earned fees when the caller may see them, otherwise new enquiries.
 * Each bar carries its month and value as an accessible name.
 */
export function PerformanceChart({ rows, feesShown, selection }) {
  const key = feesShown ? 'fees' : 'enquiries';
  const values = rows.map((row) => row[key] ?? 0);
  const max = Math.max(1, ...values);
  const heading = feesShown ? 'Fee earnings by month' : 'New enquiries by month';
  const caption = !feesShown
    ? 'From the client records in view'
    : selection.kind === 'team'
      ? 'Gross fees on earned deals'
      : 'Commission on earned deals';
  return (
    <section className="panel" aria-label={heading}>
      <TitleSection heading={heading} caption={caption} />
      <div className="perf-chart" role="list">
        {rows.map((row, index) => (
          <div className="perf-bar-wrap" key={row.month} role="listitem">
            <div
              className="perf-bar"
              role="img"
              aria-label={`${long(row.month)}: ${formatFigure(key, values[index])}`}
              style={{ height: `${Math.max(1, (values[index] / max) * 100)}%` }}
            />
            <small aria-hidden="true">{short(row.month)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export { long as monthLabel };
