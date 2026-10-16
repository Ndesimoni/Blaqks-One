import React from 'react';
import './charts.css';
import './charts-bars.css';

/**
 * Ranked horizontal bars: each row shows its name, its count with an optional `detail` and
 * `note`, and a rounded bar scaled to the largest `value`, in the row's `tone`. The visible
 * text is the text alternative; `countClass` names the element that holds each count.
 */
export function BarList({ rows, label, countClass = '' }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="chart-barlist" aria-label={label}>
      {rows.map((row) => (
        <li key={row.name}>
          <span className="chart-barlist-head">
            <span>{row.name}</span>
            <b>
              <span className={countClass}>{row.count ?? row.value}</span>
              {row.detail && <span className="chart-barlist-detail"> · {row.detail}</span>}
            </b>
          </span>
          <span className="chart-barlist-track" aria-hidden="true">
            <span
              className={`chart-barlist-fill chart-grow-x chart-tone-${row.tone || 'muted'}`}
              style={{ inlineSize: `${(row.value / max) * 100}%` }}
            />
          </span>
          {row.note && <span className="v2-caption">{row.note}</span>}
        </li>
      ))}
    </ul>
  );
}
