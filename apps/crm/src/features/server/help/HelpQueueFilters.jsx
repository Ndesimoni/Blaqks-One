import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import { GridKeptFilters } from '../../records/grid/GridKeptFilters.jsx';
import { HELP_STATES } from './helpModel.js';

// All comes first, as the grid's first preset; the queue opens on Open (usePlatformHelp).
const FILTERS = ['all', ...HELP_STATES];

/**
 * The queue's filter row, as the CRM grid's (BO1c): the search field carrying the chosen
 * state, Open, Answered and Solved as chips with their counts (choosing the pressed one again,
 * or clearing, shows All), and the Assigned pill (Everyone or Me; behind Filters on phones).
 */
export function HelpQueueFilters({ filter, counts, query, onQuery, onChange }) {
  const { t } = useI18n();
  const k = (key) => t(`help.${key}`);
  const label = (state) => k(state === 'all' ? 'all' : `state.${state}`);
  const tabs = FILTERS.map(label);
  const chipCounts = Object.fromEntries(
    HELP_STATES.map((state) => [label(state), counts[state] ?? 0]),
  );
  return (
    <GridFilterBar
      module={k('queueTitle')}
      presetLabel={label(filter.state)}
      tabs={tabs}
      tab={label(filter.state)}
      onTab={(name) => onChange({ ...filter, state: FILTERS[tabs.indexOf(name)] || 'all' })}
      query={query}
      onQuery={onQuery}
      counts={chipCounts}
      placeholder={k('search')}
      tools={
        <GridKeptFilters label={k('filters')}>
          <label className="grid-pill-filter">
            <span>{k('assigned')}</span>
            <select
              value={filter.assigned}
              onChange={(event) => onChange({ ...filter, assigned: event.target.value })}
            >
              <option value="all">{k('assignedAll')}</option>
              <option value="me">{k('assignedMe')}</option>
            </select>
          </label>
        </GridKeptFilters>
      }
    />
  );
}
