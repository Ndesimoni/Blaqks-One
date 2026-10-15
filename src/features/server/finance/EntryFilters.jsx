import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useFinanceContext } from './useFinanceRequests.js';
import {
  emptyEntryFilters,
  entryFiltersActive,
  entryKinds,
  entryStatusOptions,
} from './entryFilters.js';

/**
 * Search, status and — for approvers — the "Awaiting approval" queue (finance-design §7).
 * The queue shows every pending row; each row's own `allowed` decides its buttons.
 */
export function EntryFilters({ kind, filters, onChange, count, waiting }) {
  const { access } = useFinanceContext();
  const id = useId();
  const words = entryKinds[kind];
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  return (
    <div className="filters-toolbar finance-filters">
      <div className="search-small">
        <Icon name="search" size={16} />
        <input
          aria-label={`Search ${words.plural}`}
          placeholder={
            kind === 'payments'
              ? 'Search payments, deals or references...'
              : 'Search expenses, suppliers or categories...'
          }
          value={filters.query}
          onChange={set('query')}
        />
      </div>
      <div className="finance-filter">
        <label htmlFor={`${id}-status`}>Status</label>
        <select id={`${id}-status`} value={filters.status} onChange={set('status')}>
          {entryStatusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {access.approve && (
        <div className="finance-filter finance-queue-filter">
          <span className="finance-filter-label" aria-hidden="true">
            Approval queue
          </span>
          <button
            type="button"
            className="finance-queue-chip"
            aria-pressed={filters.queue}
            onClick={() => onChange({ ...filters, queue: !filters.queue })}
          >
            <Icon name="check" size={15} />
            Awaiting approval
            <span className="finance-queue-count">{waiting}</span>
          </button>
        </div>
      )}
      {entryFiltersActive(filters) && (
        <div className="finance-filter-summary">
          <span role="status">
            {count} {count === 1 ? words.noun : words.plural} match
          </span>
          <Button variant="light" onClick={() => onChange(emptyEntryFilters)}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
