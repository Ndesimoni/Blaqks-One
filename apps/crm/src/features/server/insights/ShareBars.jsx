import React from 'react';
import { percentOf, ranked } from './shareModel.js';

/**
 * Ranked horizontal bars: each row shows its name, count and share as text, so the bar is a
 * visual aid only. `total` is the base for the percentage.
 */
export function ShareBars({ rows, total, label, unit = ['record', 'records'] }) {
  return (
    <ul className="share-list" aria-label={label}>
      {ranked(rows).map((row) => {
        const percent = percentOf(row.value, total);
        return (
          <li key={row.name} className={row.value ? 'share-row' : 'share-row is-zero'}>
            <div className="share-head">
              <span className="share-name">{row.name}</span>
              <span className="share-figure">
                <strong>{row.value}</strong>
                <span className="sr-only"> {row.value === 1 ? unit[0] : unit[1]},</span>
                <span className="share-percent">{percent}%</span>
              </span>
            </div>
            <div className="share-track" aria-hidden="true">
              <div style={{ width: `${percent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
