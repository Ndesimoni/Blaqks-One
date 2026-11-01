import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { ViewSwitch } from '../../components/ui/ViewSwitch.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useI18n } from '../../i18n/useI18n.js';
import { GridFilterBar } from '../records/grid/GridFilterBar.jsx';

const phoneQuery = '(max-width: 750px)';

/** A filter kept beside the mockup's presets, drawn as a pill select. */
function PillSelect({ label, value, onChange, anyLabel, options }) {
  return (
    <label className="lead-pill-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{anyLabel}</option>
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The mockup's Leads filter row: the search field with the active preset, the other presets as
 * chips, List / Kanban and the column chooser. Our Source (with counts) and Lead stage filters
 * and Assigned to stay beside it; on phones they wait behind a Filters button so the first
 * leads stay in view. Clear filters shows only when something is filtered.
 */
export function LeadsToolbar({ filters, view, onView, chooser, toolbarExtras }) {
  const { t } = useI18n();
  const phone = useMediaQuery(phoneQuery);
  const [open, setOpen] = useState(false);
  const { presets, preset, onPreset, sources, source, stage, stages } = filters;
  const kept = (
    <>
      <PillSelect
        label={t('leadsBoard.source')}
        value={source}
        onChange={filters.onSource}
        anyLabel={t('leadsBoard.anySource')}
        options={sources.map(({ label, count }) => [label, `${label} (${count})`])}
      />
      <PillSelect
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
        <div className="lead-filters" role="group" aria-label="Lead filters">
          {phone ? (
            <>
              <Button
                variant="light"
                icon="filter"
                aria-expanded={open}
                aria-controls="lead-more-filters"
                onClick={() => setOpen((value) => !value)}
              >
                {t('leadsBoard.filters')}
              </Button>
              <div id="lead-more-filters" className="lead-more-filters" hidden={!open}>
                {kept}
              </div>
            </>
          ) : (
            kept
          )}
        </div>
      }
    />
  );
}
