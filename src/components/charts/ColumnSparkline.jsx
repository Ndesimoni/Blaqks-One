import React from 'react';
import './charts.css';

/**
 * Small column chart: one rounded column per period, the highlighted one (the latest by
 * default) in the accent and the rest in the quiet panel tone. `label` names the chart for
 * screen readers and `describe(value, index)` words each column, so nothing relies on colour.
 */
export function ColumnSparkline({ values, label, describe, highlight = values.length - 1 }) {
  const max = Math.max(1, ...values);
  const words = values.map((value, index) => (describe ? describe(value, index) : String(value)));
  return (
    <div className="chart-columns" role="img" aria-label={`${label}: ${words.join(', ')}`}>
      {values.map((value, index) => (
        <span
          key={index}
          className={`chart-column ${index === highlight ? 'chart-tone-accent' : 'chart-tone-bar'}`}
          style={{ blockSize: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
