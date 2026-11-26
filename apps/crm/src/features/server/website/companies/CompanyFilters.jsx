import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { GridFilterBar } from '../../../records/grid/GridFilterBar.jsx';
import '../../../records/grid/grid-filter.css';
import { FILTERS } from './companiesModel.js';

/**
 * The approved mockup's filter row for company websites (design queue item 32): All companies,
 * then Licence not verified and Not entitled with their counts, and search by company, website
 * name or address.
 */
export function CompanyFilters({ query, filter, counts, onQuery, onFilter }) {
  const { t } = useI18n();
  const label = (name) => t(`websiteCompanies.preset.${name}`);
  const tabs = FILTERS.map(label);
  return (
    <GridFilterBar
      module={t('websiteCompanies.module')}
      presetLabel={label(filter)}
      tabs={tabs}
      tab={label(filter)}
      onTab={(name) => onFilter(FILTERS[tabs.indexOf(name)])}
      query={query}
      onQuery={onQuery}
      placeholder={t('websiteCompanies.searchPlaceholder')}
      counts={Object.fromEntries(FILTERS.map((name) => [label(name), counts[name]]))}
    />
  );
}
