import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { seriesTotal } from './metricsModel.js';
import { columnHeight, shortValue, trendScale } from './trendModel.js';

/**
 * One twelve-month series as thin columns (dataviz: one hue from one baseline, hairline grid,
 * this month emphasised and labelled at its cap). Hovering a month shows its exact figure; the
 * visually hidden table carries every month for screen readers, so the picture is decorative.
 * `counts` adds the matching deal count to a money series' tooltip and table.
 */
export function TrendChart({ label, months, values, money = false, counts, compact = false }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformMetrics.${key}`, vars);
  const { max, ticks } = trendScale(values, money);
  const total = seriesTotal(values);
  const last = values.length - 1;
  // This month's label clears the columns it spans (it is wider than one column).
  const capAt = Math.max(...values.slice(-3).map((value) => columnHeight(value, max)));
  const long = months.map((month) =>
    format.date(`${month}-01`, { month: 'long', year: 'numeric' }),
  );
  const when = (index) => (index === last ? `${long[index]} (${k('soFar')})` : long[index]);
  const exact = (index) => {
    const value = values[index];
    if (value === null) return k('notTracked');
    const text = money ? format.money(value) : format.number(value);
    const count = counts?.[index];
    return Number.isInteger(count) ? `${text} · ${k('dealsCount', { count })}` : text;
  };
  return (
    <figure className={'trend-chart' + (compact ? ' is-compact' : '')}>
      {compact && <figcaption className="trend-label">{label}</figcaption>}
      <div className="trend-plot" aria-hidden="true">
        <div className="trend-axis">
          {ticks.map((tick, index) => (
            <span key={index}>{tick}</span>
          ))}
        </div>
        <div className="trend-cols">
          {(total === null || total === 0) && (
            <p className="trend-empty">{total === null ? k('notTracked') : k('noneYet')}</p>
          )}
          {values.map((value, index) => (
            <div
              key={months[index]}
              className={
                'trend-col' +
                (index === last ? ' is-current' : '') +
                (value === null ? ' is-untracked' : '')
              }
            >
              <div className="trend-slot" data-tip={`${when(index)}: ${exact(index)}`}>
                <span className="trend-bar" style={{ height: `${columnHeight(value, max)}%` }} />
                {index === last && value > 0 && (
                  <span className="trend-cap" style={{ bottom: `calc(${capAt}% + 3px)` }}>
                    {shortValue(value, money)}
                  </span>
                )}
              </div>
              <small>{format.date(`${months[index]}-01`, { month: 'short' })}</small>
            </div>
          ))}
        </div>
      </div>
      {total !== null && values.includes(null) && (
        <p className="trend-note">{k('untrackedNote')}</p>
      )}
      {/* A table ignores the 1px box, so a wrapper clips it. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{k('month')}</th>
              <th scope="col">{label}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month, index) => (
              <tr key={month}>
                <th scope="row">{when(index)}</th>
                <td>{exact(index)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
