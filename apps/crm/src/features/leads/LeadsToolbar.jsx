import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { ViewSwitch } from '../../components/ui/ViewSwitch.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { GridFilterBar } from '../records/grid/GridFilterBar.jsx';
import { GridKeptFilters } from '../records/grid/GridKeptFilters.jsx';
import { GridPillSelect } from '../records/grid/GridPillSelect.jsx';

/**
 * The mockup's Leads filter row: the search field with the active preset, the other presets as
 * chips, List / Kanban and the column chooser. Our Source (with counts) and Lead stage filters
 * and Assigned to stay beside it; on phones they wait behind a Filters button so the first
 * leads stay in view. Clear filters shows only when something is filtered.
 */
export function LeadsToolbar({ filters, view, onView, chooser, toolbarExtras }) {
  const { t } = useI18n();
  const { presets, preset, onPreset, sources, source, stage, stages } = filters;
  const kept = (
    <>
      <GridPillSelect
        label={t('leadsBoard.source')}
        value={source}
        onChange={filters.onSource}
        anyLabel={t('leadsBoard.anySource')}
        options={sources.map(({ label, count }) => [label, `${label} (${count})`])}
      />
      <GridPillSelect
        label="Lead stage"
        value={stage}
        onChange={filters.onStage}
        anyLabel="All stages"
        options={stages.map((value) => [value, value])}
      />
      {filters.active && (
        <Button variant="light" onClick={filters.onClear}>
          Clear filters
        </Button>
      )}
      {toolbarExtras}
    </>
  );
  return (
    <GridFilterBar
      module="leads"
      presetLabel={preset}
      tabs={presets}
      tab={preset}
      onTab={onPreset}
      query={filters.query}
      onQuery={filters.onQuery}
      tools={
        <>
          <ViewSwitch
            label={t('leadsBoard.view')}
            options={[
              ['list', t('leadsBoard.list'), 'menu'],
              ['kanban', t('leadsBoard.kanban'), 'grid'],
            ]}
            value={view}
            onChange={onView}
          />
          {view === 'list' && chooser}
        </>
      }
      extras={
        <GridKeptFilters label="Lead filters" className="lead-filters">
          {kept}
        </GridKeptFilters>
      }
    />
  );
}
