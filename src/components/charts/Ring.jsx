import React from 'react';
import { ringDashes } from './chartGeometry.js';
import './charts.css';
import './charts-ring.css';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Ring of parts with round caps and a centre figure (`children`). `segments` are
 * `{ name, value, tone }`; the accessible name lists each part with `format`, and the ledger
 * beside it repeats them. The gap allows for the round caps between parts.
 */
export function Ring({ segments, label, format = String, children }) {
  const dashes = ringDashes(
    segments.map((segment) => segment.value),
    CIRCUMFERENCE,
    14,
  );
  const words = segments.map((segment) => `${segment.name} ${format(segment.value)}`).join(', ');
  return (
    <div className="chart-ring">
      <svg role="img" aria-label={`${label}: ${words}`} viewBox="0 0 120 120">
        <circle className="chart-ring-track" cx="60" cy="60" r={RADIUS} />
        <g className="chart-ring-parts">
          {segments.map((segment, index) =>
            dashes[index].length > 0 ? (
              <circle
                key={segment.name}
                className={`chart-ring-part chart-stroke-${segment.tone || 'accent'}`}
                cx="60"
                cy="60"
                r={RADIUS}
                strokeDasharray={`${dashes[index].length} ${CIRCUMFERENCE}`}
                strokeDashoffset={dashes[index].offset}
              />
            ) : null,
          )}
        </g>
      </svg>
      <div className="chart-ring-centre">{children}</div>
    </div>
  );
}
