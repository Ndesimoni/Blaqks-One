import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useFinanceContext } from './useFinanceRequests.js';
import { dealStages } from './dealModel.js';
import { earnedFilters, emptyDealFilters, filtersActive, QUEUE } from './dealFilters.js';

/** Search, stage and earned-state filters; "Assigned to" for team view only (§7). */
export function DealFilters({ filters, onChange, count }) {
  const { team, assignees, user } = useFinanceContext();
  const id = useId();
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  const active = filtersActive(filters);
  return (
    <div className="filters-toolbar finance-filters">
      <div className="search-small">
        <Icon name="search" size={16} />
        <input
          aria-label="Search deals"
          placeholder="Search deals, clients or properties..."
          value={filters.query}
          onChange={set('query')}
        />
      </div>
      <div className="finance-filter">
        <label htmlFor={`${id}-stage`}>Stage</label>
        <select id={`${id}-stage`} value={filters.stage} onChange={set('stage')}>
          <option value="">Any stage</option>
          {dealStages.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
      </div>
      <div className="finance-filter">
        <label htmlFor={`${id}-earned`}>Earned</label>
        <select id={`${id}-earned`} value={filters.earned} onChange={set('earned')}>
          {earnedFilters.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {team && (
        <div className="finance-filter">
          <label htmlFor={`${id}-holder`}>Assigned to</label>
          <select id={`${id}-holder`} value={filters.holder} onChange={set('holder')}>
            <option value="">Everyone</option>
            <option value={QUEUE}>Team queue</option>
            {assignees.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.id === user.id ? `${person.name} (you)` : person.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {active && (
        <div className="finance-filter-summary">
          <span role="status">
            {count} {count === 1 ? 'deal' : 'deals'} match
          </span>
          <Button variant="light" onClick={() => onChange(emptyDealFilters)}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
