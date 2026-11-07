import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { ViewSwitch } from '../../../components/ui/ViewSwitch.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import { GridKeptFilters } from '../../records/grid/GridKeptFilters.jsx';
import { GridPillSelect } from '../../records/grid/GridPillSelect.jsx';
import { dealStages } from './dealModel.js';
import {
  dealPresets,
  earnedFilters,
  emptyDealFilters,
  filtersActive,
  QUEUE,
} from './dealFilters.js';
import { useFinanceContext } from './useFinanceRequests.js';

/**
 * The mockup's Deals filter row (design queue item 5): the search field with the active preset
 * (All deals, Closing this month), List / Kanban and, in List, the column chooser. Our Stage,
 * Earned and, in the team view, Assigned to stay beside it as pill selects (behind Filters on
 * phones); Clear filters shows only when one of them is set.
 */
export function DealsToolbar({ filters, onChange, view, onView, chooser }) {
  const { t } = useI18n();
  const { team, assignees, user } = useFinanceContext();
  const set = (key) => (value) => onChange({ ...filters, [key]: value });
  const people = assignees.people.map((person) => [
    person.id,
    person.id === user.id ? `${person.name} (you)` : person.name,
  ]);
  return (
    <GridFilterBar
      module="deals"
      presetLabel={filters.preset}
      tabs={dealPresets}
      tab={filters.preset}
      onTab={set('preset')}
      query={filters.query}
      onQuery={set('query')}
      tools={
        <>
          <ViewSwitch
            label={t('dealsBoard.view')}
            options={[
              ['list', t('dealsBoard.list'), 'menu'],
              ['kanban', t('dealsBoard.kanban'), 'grid'],
            ]}
            value={view}
            onChange={onView}
          />
          {view === 'list' && chooser}
        </>
      }
      extras={
        <GridKeptFilters label={t('dealsBoard.filters')}>
          <GridPillSelect
            label="Stage"
            value={filters.stage}
            onChange={set('stage')}
            anyLabel="Any stage"
            options={dealStages.map((stage) => [stage, stage])}
          />
          <GridPillSelect
            label="Earned"
            value={filters.earned}
            onChange={set('earned')}
            anyLabel={earnedFilters[0].label}
            options={earnedFilters.slice(1).map((option) => [option.id, option.label])}
          />
          {team && (
            <GridPillSelect
              label="Assigned to"
              value={filters.holder}
              onChange={set('holder')}
              anyLabel="Everyone"
              options={[[QUEUE, 'Team queue'], ...people]}
            />
          )}
          {filtersActive(filters) && (
            <Button
              variant="light"
              onClick={() =>
                onChange({ ...emptyDealFilters, preset: filters.preset, query: filters.query })
              }
            >
              {t('dealsBoard.clear')}
            </Button>
          )}
        </GridKeptFilters>
      }
    />
  );
}
