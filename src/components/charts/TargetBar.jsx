import React from 'react';
import { percentOf } from './chartGeometry.js';
import './charts.css';

/**
 * Progress against a positive target: a track with an end marker at the target, the filled
 * share in the accent and "x% of target" beside it. Render it only when a target exists.
 * `thin` is the compact variant used inside tables.
 */
export function TargetBar({ value, target, label, thin = false, caption = 'of target' }) {
  const percent = percentOf(value, target) ?? 0;
  return (
    <div className={thin ? 'chart-target chart-target-thin' : 'chart-target'}>
      <div
        className="chart-target-track"
        role="img"
        aria-label={`${label}: ${percent}% ${caption}`}
      >
        <span
          className="chart-target-fill chart-grow-x"
          style={{ inlineSize: `${Math.min(100, percent)}%` }}
        />
        <i className="chart-target-marker" />
      </div>
      <span className="chart-target-text v2-label" aria-hidden="true">
        {percent}% {caption}
      </span>
    </div>
  );
}
