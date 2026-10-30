import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { readableDate } from '../../../lib/dates.js';
import { dayParts, groupByMonth } from './resultGroups.js';

/**
 * Every match in one bounded scroll area, grouped under month headings in the model's date
 * order. Each row opens its record (or the finance section) exactly as before.
 */
export function DateResultGroups({ rows, icon, onOpen }) {
  return (
    <div className="ds-scroll" role="region" aria-label="Date search matches" tabIndex={0}>
      {groupByMonth(rows).map((group) => (
        <section key={group.key} className="ds-group" aria-label={group.label}>
          <h3 className="ds-month">
            {group.label}
            <span>{group.rows.length}</span>
          </h3>
          <ul>
            {group.rows.map((row) => {
              const { day, weekday } = dayParts(row.date);
              return (
                <li key={row.key}>
                  <button type="button" className="ds-row" onClick={() => onOpen(row)}>
                    <span className="ds-day" aria-hidden="true">
                      <b>{day}</b>
                      <small>{weekday}</small>
                    </span>
                    <span className="ds-row-icon" aria-hidden="true">
                      <Icon name={icon} size={16} />
                    </span>
                    <span className="ds-row-text">
                      <strong>{row.title}</strong>
                      <small>{row.subtitle || 'No linked record'}</small>
                    </span>
                    <span className="ds-row-date">{readableDate(row.date)}</span>
                    <Icon name="chevron" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
