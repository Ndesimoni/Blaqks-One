import React, { useId } from 'react';
import { areaPath, linePath, niceMax, seriesPoints } from './chartGeometry.js';
import './charts.css';
import './charts-area.css';
import './charts-callout.css';

const WIDTH = 1200;
const HEIGHT = 200;
const pct = (value, of) => `${(value / of) * 100}%`;

/**
 * This period against the previous one: the current series as a line over a soft area, the
 * previous series dashed, three gridlines with axis labels, an end dot on the latest point and
 * a hover tip per column. `points` are `{ label, name, current, previous }`; `format` writes a
 * value in full and `axis` writes the short axis labels. Time runs in the reading direction.
 * `callout` (the latest-month note) sits at the end, on the side away from the latest point.
 */
export function ComparisonArea({ points, label, format, axis, names, callout, legend = true }) {
  const fill = `chart-fill-${useId().replace(/:/g, '')}`;
  const current = points.map((point) => point.current);
  const previous = points.map((point) => point.previous);
  const max = niceMax(Math.max(0, ...current, ...previous));
  const now = seriesPoints(current, max, WIDTH, HEIGHT);
  const before = seriesPoints(previous, max, WIDTH, HEIGHT);
  const last = now.at(-1);
  const ticks = [max, max / 2, 0];
  const words = points.map((point) => `${point.name} ${format(point.current)}`).join(', ');
  return (
    <div className="chart-area">
      <div className="chart-area-plot">
        <ol className="chart-area-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <li key={tick} style={{ insetBlockStart: pct(HEIGHT - (tick / max) * HEIGHT, HEIGHT) }}>
              {axis(tick)}
            </li>
          ))}
        </ol>
        <svg
          role="img"
          aria-label={`${label}: ${words}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
        >
          {ticks.map((tick) => (
            <line
              key={tick}
              className="chart-grid"
              x1="0"
              x2={WIDTH}
              y1={HEIGHT - (tick / max) * HEIGHT}
              y2={HEIGHT - (tick / max) * HEIGHT}
            />
          ))}
          <path className="chart-line chart-line-previous" d={linePath(before)} />
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop className="chart-area-stop" offset="0" stopOpacity="0.35" />
              <stop className="chart-area-stop" offset="1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="chart-grow-y">
            <path d={areaPath(now, HEIGHT)} fill={`url(#${fill})`} />
            <path className="chart-line chart-line-current" d={linePath(now)} />
          </g>
        </svg>
        {last && (
          <i
            className="chart-area-dot"
            style={{ insetInlineStart: pct(last[0], WIDTH), insetBlockStart: pct(last[1], HEIGHT) }}
          />
        )}
        {callout && last && (
          <div className="chart-area-callout" data-place={last[1] < HEIGHT / 2 ? 'low' : 'high'}>
            {callout}
          </div>
        )}
        <ol className="chart-area-hits" aria-hidden="true">
          {points.map((point) => (
            <li key={point.name}>
              <span className="chart-area-tip">
                <b>{point.name}</b>
                <span>
                  {names.current} {format(point.current)}
                </span>
                <span>
                  {names.previous} {format(point.previous)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <ol className="chart-area-months v2-label" aria-hidden="true">
        {points.map((point, index) => (
          <li key={point.name} data-odd={index % 2 ? true : undefined}>
            {point.label}
          </li>
        ))}
      </ol>
      {legend && <ComparisonLegend names={names} />}
    </div>
  );
}

/** "This year" and "Last year" keys, for callers that place the legend themselves. */
export function ComparisonLegend({ names }) {
  return (
    <ul className="chart-legend" aria-hidden="true">
      <li>
        <i className="chart-swatch chart-swatch-line" />
        {names.current}
      </li>
      <li>
        <i className="chart-swatch chart-swatch-dashed" />
        {names.previous}
      </li>
    </ul>
  );
}
