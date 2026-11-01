import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { ViewSwitch } from '../../components/ui/ViewSwitch.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useI18n } from '../../i18n/useI18n.js';
import { LeadSourceFilters } from './LeadSourceFilters.jsx';

const phoneQuery = '(max-width: 750px)';

/**
 * Source presets, search, stage and view controls shared by both Leads presentations. On
 * phones the stage and assignment filters wait behind a Filters button, so the first leads
 * stay in view; the DOM follows the screen order, so keyboard order matches what is seen.
 */
export function LeadsToolbar({ filters, view, onView, toolbarExtras }) {
  const { t } = useI18n();
  const phone = useMediaQuery(phoneQuery);
  const [open, setOpen] = useState(false);
  const { sources, source, total, stage, stages, query, onSource, onStage, onQuery, onClear } =
    filters;
  const stageField = (
    <label className="lead-stage-filter">
      <span>Lead stage</span>
      <select value={stage} onChange={(event) => onStage(event.target.value)}>
        <option value="">All stages</option>
        {stages.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </label>
  );
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
        {!phone && stageField}
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
              {stageField}
              {toolbarExtras}
            </div>
          </>
        ) : (
          toolbarExtras
        )}
      </div>
    </>
  );
}
