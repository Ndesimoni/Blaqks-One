import React from 'react';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { monthLabel } from './PerformanceChart.jsx';
import { formatFigure } from './targetsModel.js';
import './performance-history.css';

/**
 * The rolling twelve months, newest first, with only the measures this caller may see. It is
 * also the chart's data-table alternative; the selected month is the first, highlighted row.
 */
export function PerformanceHistory({ rows, metrics, financeReady }) {
  const shown = metrics.filter((metric) => !metric.finance || financeReady);
  const newest = rows.at(-1)?.month;
  return (
    <section className="panel perf-history" aria-label="Monthly performance history">
      <TitleSection
        heading="Monthly performance history"
        caption="12-month rolling overview · newest first"
      />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              {shown.map((metric) => (
                <th key={metric.key} scope="col" className="num">
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((row) => (
              <tr key={row.month} className={row.month === newest ? 'is-current' : undefined}>
                <th scope="row" className="cell-strong">
                  {monthLabel(row.month)}
                </th>
                {shown.map((metric) => {
                  const value = row[metric.key] ?? 0;
                  return (
                    <td key={metric.key} className={value ? 'num' : 'num is-zero'}>
                      {formatFigure(metric.key, value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
