import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridKeptFilters } from '../../records/grid/GridKeptFilters.jsx';
import { actionOptions } from './activityVocabulary.js';
import { emptyFilters, filterKeys } from './activityFilters.js';
import { rangeLabel } from './activityModel.js';
import '../../records/grid/grid-filter.css';
import '../../records/grid/grid-pills.css';

/** One kept filter drawn as the grid's pill, with its own label for the control. */
function Pill({ id, label, children }) {
  return (
    <span className="grid-pill-filter activity-pill">
      <label htmlFor={id}>{label}</label>
      {children}
    </span>
  );
}

/**
 * The approved mockup's feed filter row (design queue item 21): the field names whose activity
 * shows and the dates, then date range, member, type, section and action as pills (behind
 * Filters on phones). Every change is written to the URL, which restarts the feed.
 */
export function ActivityFilters(props) {
  const { filters, range, problem, manager, channels, people, sections, userId, onChange } = props;
  const { t } = useI18n();
  const id = useId();
  const set = (key) => (event) => {
    const next = { ...filters, [key]: event.target.value };
    if (key === 'type' && ['team', 'channel'].includes(next.type)) next.section = '';
    if (
      key === 'type' &&
      next.action &&
      !actionOptions(next.type, manager, channels).some((option) => option.value === next.action)
    )
      next.action = '';
    onChange(next);
  };
  const count = filterKeys.filter((key) => filters[key]).length;
  return (
    <>
      <div className="grid-filterbar activity-filterbar">
        <div className="grid-filter-field activity-scope">
          <span className="grid-preset-pill">{count ? 'Filtered' : 'Everything'}</span>
          <span className="activity-scope-text">
            <strong>{manager ? 'Everyone' : 'Your actions'}</strong> · {rangeLabel(range)} · Dubai
            time
          </span>
        </div>
        <GridKeptFilters label="Activity filters">
          <Pill id={`${id}-from`} label="From">
            <input
              id={`${id}-from`}
              type="date"
              value={range.from}
              max={range.to}
              onChange={set('from')}
            />
          </Pill>
          <Pill id={`${id}-to`} label="To">
            <input
              id={`${id}-to`}
              type="date"
              value={range.to}
              min={range.from}
              onChange={set('to')}
            />
          </Pill>
          {manager && (
            <Pill id={`${id}-member`} label="Member">
              <select id={`${id}-member`} value={filters.member} onChange={set('member')}>
                <option value="">Everyone</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.id === userId ? `${person.name} (you)` : person.name}
                  </option>
                ))}
              </select>
            </Pill>
          )}
          {manager && (
            <Pill id={`${id}-type`} label="Type">
              <select id={`${id}-type`} value={filters.type} onChange={set('type')}>
                <option value="">Records and team</option>
                <option value="record">Record changes</option>
                <option value="team">Team changes</option>
                {channels && <option value="channel">{t('channels.activity.type')}</option>}
              </select>
            </Pill>
          )}
          <Pill id={`${id}-section`} label="CRM section">
            <select
              id={`${id}-section`}
              value={filters.section}
              disabled={['team', 'channel'].includes(filters.type)}
              onChange={set('section')}
            >
              <option value="">All sections</option>
              {sections.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Pill>
          <Pill id={`${id}-action`} label="Action">
            <select id={`${id}-action`} value={filters.action} onChange={set('action')}>
              <option value="">All actions</option>
              {actionOptions(filters.type, manager, channels).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.labelKey ? t(option.labelKey) : option.label}
                </option>
              ))}
            </select>
          </Pill>
          {count > 0 && (
            <Button variant="light" icon="close" onClick={() => onChange(emptyFilters)}>
              Clear filters
            </Button>
          )}
        </GridKeptFilters>
      </div>
      {problem && (
        <p className="field-error activity-range-error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
