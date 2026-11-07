import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import { GridKeptFilters } from '../../records/grid/GridKeptFilters.jsx';
import { OWNER_FILTERS, PRESETS } from './clientsModel.js';

/**
 * The clients' filter row, as the CRM grid's: the search field carrying the active preset,
 * the stages as chips with their counts, the Assigned filter (Everyone, Mine, Unassigned;
 * behind Filters on phones) and, for Manage, Add client at the end.
 */
export function ClientsToolbar({ view, counts, onView, onAdd }) {
  const { t } = useI18n();
  const k = (key) => t(`platformClients.${key}`);
  const label = (preset) => k(preset === 'all' ? 'preset.all' : `stage.${preset}`);
  const tabs = PRESETS.map(label);
  const chipCounts = counts
    ? Object.fromEntries(PRESETS.slice(1).map((stage) => [label(stage), counts[stage]]))
    : null;
  return (
    <GridFilterBar
      module={k('module')}
      presetLabel={label(view.stage)}
      tabs={tabs}
      tab={label(view.stage)}
      onTab={(name) => onView({ ...view, stage: PRESETS[tabs.indexOf(name)] || 'all' })}
      query={view.query}
      onQuery={(query) => onView({ ...view, query })}
      counts={chipCounts}
      placeholder={k('search')}
      tools={
        <GridKeptFilters label={k('filters')}>
          <label className="grid-pill-filter">
            <span>{k('assigned')}</span>
            <select
              value={view.owner}
              onChange={(event) => onView({ ...view, owner: event.target.value })}
            >
              {OWNER_FILTERS.map((owner) => (
                <option key={owner} value={owner}>
                  {k(`owner.${owner}`)}
                </option>
              ))}
            </select>
          </label>
        </GridKeptFilters>
      }
      extras={
        onAdd && (
          <Button icon="plus" className="platform-clients-add" onClick={onAdd}>
            {k('add')}
          </Button>
        )
      }
    />
  );
}
