import React, { useId } from 'react';

/**
 * One key-figure bento tile: label with an optional chip, the large value, a small chart
 * suited to its meaning and a supporting line. Money values keep the exact AED amount for
 * screen readers.
 */
export function KeyFigureTile({ item, className = '', style }) {
  const id = useId();
  const hidden = item.full ? true : undefined;
  return (
    <div
      className={`v2-tile key-figure ${className}`}
      style={style}
      role="group"
      aria-labelledby={id}
      data-key={item.key}
    >
      <div className="v2-tile-head">
        <p id={id} className="v2-label key-figure-label">
          {item.label}
        </p>
        {item.chip && <span className={`v2-chip v2-chip-${item.chip.tone}`}>{item.chip.text}</span>}
      </div>
      {item.state === 'loading' ? (
        <div className="key-figure-loading" role="status">
          <span className="sr-only">Loading {item.label}…</span>
        </div>
      ) : (
        <p className="key-figure-main">
          <span className="v2-figure key-figure-value" aria-hidden={hidden}>
            {item.value}
          </span>
          {item.full && <span className="sr-only">{item.full}</span>}
        </p>
      )}
      <div className="key-figure-chart">{item.chart || null}</div>
      <p className="key-figure-sub">
        {item.state === 'loading' ? ' ' : item.sub}
        {item.note && <span className="key-figure-note"> · {item.note}</span>}
      </p>
    </div>
  );
}
