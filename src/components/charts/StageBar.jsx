import React from 'react';
import { shares } from './chartGeometry.js';
import './charts.css';

/**
 * Segmented 100% bar with an optional mono legend. `segments` are `{ name, value, tone }`
 * where tone is one of accent, blue, amber, muted, ink or bar. The legend repeats
 * every name and value, so identity never relies on colour alone.
 */
export function StageBar({ segments, label, legend = true, format = String }) {
  const present = segments.filter((segment) => segment.value > 0);
  const percent = shares(present.map((segment) => segment.value));
  const words = segments.map((segment) => `${segment.name} ${format(segment.value)}`).join(', ');
  return (
    <div className="chart-stage">
      <div className="chart-stage-bar chart-grow-x" role="img" aria-label={`${label}: ${words}`}>
        {present.map((segment, index) => (
          <span
            key={segment.name}
            className={`chart-stage-segment chart-tone-${segment.tone || 'accent'}`}
            style={{ flexGrow: percent[index] || 1 }}
          />
        ))}
        {!present.length && <span className="chart-stage-segment chart-tone-bar" />}
      </div>
      {legend && (
        <ul className="chart-legend" aria-hidden="true">
          {segments.map((segment) => (
            <li key={segment.name}>
              <i className={`chart-swatch chart-tone-${segment.tone || 'accent'}`} />
              {segment.name}
              <b>{format(segment.value)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
