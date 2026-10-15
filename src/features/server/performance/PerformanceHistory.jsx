import React from 'react';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { monthLabel } from './PerformanceChart.jsx';
import { formatFigure } from './targetsModel.js';

/** The rolling twelve months, newest first, with only the measures this caller may see. */
export function PerformanceHistory({ rows, metrics, financeReady }) {
  const shown = metrics.filter((metric) => !metric.finance || financeReady);
  return (
    <section className="panel" aria-label="Monthly performance history">
      <TitleSection heading="Monthly performance history" caption="12-month rolling overview" />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              {shown.map((metric) => (
                <th key={metric.key} scope="col">
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((row) => (
              <tr key={row.month}>
                <th scope="row" className="cell-strong">
                  {monthLabel(row.month)}
                </th>
                {shown.map((metric) => (
                  <td key={metric.key}>{formatFigure(metric.key, row[metric.key] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
