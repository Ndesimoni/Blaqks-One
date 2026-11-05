import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { ViewSwitch } from '../../components/ui/ViewSwitch.jsx';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { GridFilterBar } from '../records/grid/GridFilterBar.jsx';
import { matchesPropertyPreset, propertyPresets } from './selectors.js';

const keyOf = new Map(propertyPresets.map(({ key, label }) => [label, key]));

/**
 * The mockup's Properties filter row: the field with the active preset (All listings by
 * default), the mockup's Available and our listing purposes as chips with their counts, then
 * Filters (the refine panel), List / Cards and, for the list, the column chooser. `extras`
 * holds the connected Assigned to.
 */
export function PropertyToolbar({
  all,
  f,
  activeCount,
  extras,
  filtersId,
  filtersOpen,
  setFiltersOpen,
  updateFilter,
  chooser,
}) {
  const { query, setQuery, setPage, viewMode, setViewMode } = useWorkspaceView();
  const { t } = useI18n();
  const active = propertyPresets.find(({ key }) => key === f.purpose) || propertyPresets[0];
  const counts = Object.fromEntries(
    propertyPresets
      .slice(1)
      .map(({ key, label }) => [
        label,
        all.filter((property) => matchesPropertyPreset(property, key)).length,
      ]),
  );
  return (
    <GridFilterBar
      module="properties"
      presetLabel={active.label}
      tabs={propertyPresets.map(({ label }) => label)}
      tab={active.label}
      onTab={(label) => updateFilter('purpose', keyOf.get(label))}
      query={query}
      onQuery={(value) => {
        setQuery(value);
        setPage(0);
      }}
      counts={counts}
      tools={
        <>
          <button
            type="button"
            className="property-filter-trigger"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Icon name="filter" size={17} />
            {t('properties.filters')}
            {activeCount ? ` (${activeCount})` : ''}
          </button>
          <ViewSwitch
            label={t('properties.view')}
            options={[
              ['table', t('properties.list'), 'menu'],
              ['cards', t('properties.cards'), 'grid'],
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
          {viewMode === 'table' && chooser}
        </>
      }
      extras={extras}
    />
  );
}
