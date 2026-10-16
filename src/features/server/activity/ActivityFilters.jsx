import React, { useId, useState } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { actionOptions } from './activityVocabulary.js';
import { emptyFilters, filterKeys } from './activityFilters.js';
import { rangeLabel } from './activityModel.js';

function Field({ id, label, children }) {
  return (
    <div className="activity-field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

/**
 * Date range, member, type, section and action. Every change is written to the URL, which
 * restarts the feed from its first page. On phones the fields fold behind a Filters button.
 */
export function ActivityFilters(props) {
  const { filters, range, problem, manager, people, sections, userId, onChange } = props;
  const id = useId();
  const [open, setOpen] = useState(false);
  const set = (key) => (event) => {
    const next = { ...filters, [key]: event.target.value };
    if (key === 'type' && next.type === 'team') next.section = '';
    if (
      key === 'type' &&
      next.action &&
      !actionOptions(next.type, manager).some((option) => option.value === next.action)
    )
      next.action = '';
    onChange(next);
  };
  const count = filterKeys.filter((key) => filters[key]).length;
  return (
    <section className="panel activity-toolbar" aria-label="Activity filters">
      <div className="activity-toolbar-top">
        <div className="activity-context">
          <span className="activity-context-icon" aria-hidden="true">
            <Icon name={manager ? 'users' : 'person'} size={20} />
          </span>
          <div>
            <h2>{manager ? 'Everyone in this workspace' : 'Your actions'}</h2>
            <p>{rangeLabel(range)} · Dubai time</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-light activity-filter-toggle"
          aria-expanded={open}
          aria-controls={`${id}-fields`}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="filter" size={16} />
          <span>Filters</span>
          {count > 0 && <span className="activity-filter-count">{count}</span>}
        </button>
      </div>
      <div id={`${id}-fields`} className={'activity-filter-fields' + (open ? ' is-open' : '')}>
        <Field id={`${id}-from`} label="From">
          <input
            id={`${id}-from`}
            type="date"
            value={range.from}
            max={range.to}
            onChange={set('from')}
          />
        </Field>
        <Field id={`${id}-to`} label="To">
          <input
            id={`${id}-to`}
            type="date"
            value={range.to}
            min={range.from}
            onChange={set('to')}
          />
        </Field>
        {manager && (
          <Field id={`${id}-member`} label="Member">
            <select id={`${id}-member`} value={filters.member} onChange={set('member')}>
              <option value="">Everyone</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.id === userId ? `${person.name} (you)` : person.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {manager && (
          <Field id={`${id}-type`} label="Type">
            <select id={`${id}-type`} value={filters.type} onChange={set('type')}>
              <option value="">Records and team</option>
              <option value="record">Record changes</option>
              <option value="team">Team changes</option>
            </select>
          </Field>
        )}
        <Field id={`${id}-section`} label="CRM section">
          <select
            id={`${id}-section`}
            value={filters.section}
            disabled={filters.type === 'team'}
            onChange={set('section')}
          >
            <option value="">All sections</option>
            {sections.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-action`} label="Action">
          <select id={`${id}-action`} value={filters.action} onChange={set('action')}>
            <option value="">All actions</option>
            {actionOptions(filters.type, manager).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {count > 0 && (
          <button
            type="button"
            className="btn btn-light activity-clear"
            onClick={() => onChange(emptyFilters)}
          >
            <Icon name="close" size={15} />
            <span>Clear filters</span>
          </button>
        )}
      </div>
      {problem && (
        <p className="field-error activity-range-error" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
