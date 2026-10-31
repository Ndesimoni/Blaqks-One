import React from 'react';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { formatFigure } from './targetsModel.js';
import { axisFloor, axisLabel, barHeight, longMonth, niceMax, shortMonth } from './chartModel.js';
import './performance-chart.css';
import './performance-chart-labels.css';

/**
 * Twelve-month bars: earned fees when the caller may see them, otherwise new enquiries. Each bar
 * carries its month and value as an accessible name and a hover tooltip; the selected month is
 * highlighted. The history table below is the full data-table alternative.
 */
export function PerformanceChart({ rows, feesShown, selection }) {
  const key = feesShown ? 'fees' : 'enquiries';
  const values = rows.map((row) => row[key] ?? 0);
  const axisMax = niceMax(Math.max(0, ...values), axisFloor(key));
  const total = values.reduce((sum, value) => sum + value, 0);
  const heading = feesShown ? 'Fee earnings by month' : 'New enquiries by month';
  const caption = !feesShown
    ? 'From the client records in view'
    : selection.kind === 'team'
      ? 'Gross fees on earned deals'
      : 'Commission on earned deals';
  const ticks = [axisMax, axisMax / 2, 0];
  return (
    <section className="panel perf-chart-panel" aria-label={heading}>
      <TitleSection
        heading={heading}
        caption={caption}
        action={
          <div className="perf-chart-total">
            <span>12-month total</span>
            <strong>{formatFigure(key, total)}</strong>
          </div>
        }
      />
      <div className="perf-plot">
        <div className="perf-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{axisLabel(key, tick)}</span>
          ))}
        </div>
        <div className="perf-bars" role="list">
          {total === 0 && (
            <p className="perf-chart-empty">
              {feesShown ? 'No earned fees' : 'No new enquiries'} in these 12 months
            </p>
          )}
          {rows.map((row, index) => {
            const text = `${longMonth(row.month)}: ${formatFigure(key, values[index])}`;
            const current = index === rows.length - 1;
            return (
              <div className="perf-col" key={row.month} role="listitem">
                <div className="perf-slot">
                  <div
                    className={current ? 'perf-bar is-current' : 'perf-bar'}
                    role="img"
                    aria-label={text}
                    data-tip={text}
                    style={{ height: `${barHeight(values[index], axisMax)}%` }}
                  >
                    {current && values[index] > 0 && (
                      <span className="perf-bar-value" aria-hidden="true">
                        {axisLabel(key, values[index])}
                      </span>
                    )}
                  </div>
                </div>
                <small aria-hidden="true" className={current ? 'is-current' : undefined}>
                  {shortMonth(row.month)}
                </small>
              </div>
            );
          })}
        </div>
      </div>
      <p className="perf-chart-note">Exact figures for every month are in the history table.</p>
    </section>
  );
}

export { longMonth as monthLabel };
