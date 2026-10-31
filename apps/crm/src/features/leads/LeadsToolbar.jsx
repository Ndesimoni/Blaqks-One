import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { ViewSwitch } from '../../components/ui/ViewSwitch.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { LeadSourceFilters } from './LeadSourceFilters.jsx';

/** Source presets, search, stage and view controls shared by both Leads presentations. */
export function LeadsToolbar({ filters, view, onView, toolbarExtras }) {
  const { t } = useI18n();
  const { sources, source, total, stage, stages, query, onSource, onStage, onQuery, onClear } =
    filters;
  return (
    <>
      <div className="lead-source-bar">
        <span className="lead-source-label" aria-hidden="true">
          Source
        </span>
        <LeadSourceFilters
          sources={sources}
          selectedSource={source}
          total={total}
          onChange={onSource}
        />
        <ViewSwitch
          label={t('leadsBoard.view')}
          options={[
            ['list', t('leadsBoard.list'), 'menu'],
            ['kanban', t('leadsBoard.kanban'), 'grid'],
          ]}
          value={view}
          onChange={onView}
        />
      </div>
      <div className="lead-filters" role="group" aria-label="Lead filters">
        <label className="lead-stage-filter">
          <span>Lead stage</span>
          <select value={stage} onChange={(event) => onStage(event.target.value)}>
            <option value="">All stages</option>
            {stages.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="search-small">
          <Icon name="search" size={16} />
          <input
            aria-label="Search leads"
            placeholder="Name, phone, email, source or campaign..."
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>
        <Button variant="light" disabled={!source && !stage && !query} onClick={onClear}>
          Clear filters
        </Button>
        {toolbarExtras}
      </div>
    </>
  );
}
