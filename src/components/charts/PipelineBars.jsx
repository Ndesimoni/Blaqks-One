import React from 'react';
import { shares } from './chartGeometry.js';
import './charts.css';
import './charts-bars.css';

/**
 * Vertical rounded columns per stage, in stage order: the count above, the stage name and its
 * share of all rows below. Rows may carry a `tone` (blue by default; later blue stages fade).
 * The list is the text alternative (each column reads "Qualified, 4 leads, 40%"). No
 * stage-to-stage conversion is shown, because the records carry no stage history.
 */
export function PipelineBars({ rows, label, unit = ['lead', 'leads'] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const percent = shares(rows.map((row) => row.count));
  return (
    <div className="chart-pipeline-scroll">
      <ol className="chart-pipeline" aria-label={label} style={{ '--stages': rows.length }}>
        {rows.map((row, index) => {
          const tone = row.tone || 'blue';
          const fade = tone === 'blue' ? Math.max(0.35, 0.9 - index * 0.08) : 1;
          return (
            <li
              key={row.name}
              aria-label={`${row.name}, ${row.count} ${row.count === 1 ? unit[0] : unit[1]}, ${percent[index]}%`}
            >
              <strong className="chart-pipeline-count">{row.count}</strong>
              <span className="chart-pipeline-track" aria-hidden="true">
                <span
                  className={`chart-pipeline-fill chart-grow-y chart-tone-${tone}`}
                  style={{ blockSize: `${Math.max(6, (row.count / max) * 100)}%`, opacity: fade }}
                />
              </span>
              <span className="chart-pipeline-name" title={row.name}>
                {row.name}
              </span>
              <span className="v2-chip chart-pipeline-share">{percent[index]}%</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
