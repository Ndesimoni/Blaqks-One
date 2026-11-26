import React from 'react';
import { GridFilterBar } from '../../../records/grid/GridFilterBar.jsx';
import '../../../records/grid/grid-filter.css';

/** The mockup's presets first (Everyone, Shown, Waiting for consent), then ours. */
export const TEAM_PRESETS = ['everyone', 'public', 'waiting', 'hidden', 'notSetUp'];

/** The rows a preset and search leave: by profile status, then name or email. */
export function teamView(rows, { preset, query }) {
  const needle = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (preset === 'everyone' || row.status === preset) &&
      (!needle || `${row.member.name} ${row.member.email || ''}`.toLowerCase().includes(needle)),
  );
}

/** The website team's filter row, as the approved mockup's grid view (design queue item 22). */
export function TeamFilterBar({ view, onView, t }) {
  const label = (key) => t(`websiteTeam.preset.${key}`);
  const tabs = TEAM_PRESETS.map(label);
  return (
    <GridFilterBar
      module={t('websiteTeam.label').toLowerCase()}
      presetLabel={label(view.preset)}
      tabs={tabs}
      tab={label(view.preset)}
      onTab={(name) => onView({ ...view, preset: TEAM_PRESETS[tabs.indexOf(name)] })}
      query={view.query}
      onQuery={(query) => onView({ ...view, query })}
    />
  );
}
