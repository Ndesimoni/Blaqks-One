import React from 'react';

/**
 * A stat tile's small trend (dataviz stat-tile contract): one column per period on a shared
 * baseline, the context periods in the quiet gray and `current` in the accent. The figures are
 * in the accessible `summary` and each column's tooltip, so nothing rests on the picture alone.
 * A null value (not tracked yet) draws no column and reads as a dash, never as zero.
 */
export function Sparkbars({ values, labels, current = values.length - 1, summary }) {
  const max = Math.max(1, ...values);
  return (
    <div className="sparkbars" role="img" aria-label={summary}>
      {values.map((value, index) => (
        <span
          key={labels[index]}
          className={'sparkbar' + (index === current ? ' is-current' : '')}
          style={{ height: `${value ? Math.max(12, (value / max) * 100) : 0}%` }}
          title={`${labels[index]}: ${value ?? '—'}`}
        />
      ))}
    </div>
  );
}
