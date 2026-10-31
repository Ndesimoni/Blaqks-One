import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { FILTERS } from './companiesModel.js';

/** Search by company, website name or address, and narrow by the flag still to check. */
export function CompanyFilters({ query, filter, counts, onQuery, onFilter, onClear, searchRef }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteCompanies.${key}`, vars);
  return (
    <section className="panel website-list-filters" aria-label={k('table')}>
      <div className="field">
        <label htmlFor="website-companies-search">{k('search')}</label>
        <input
          ref={searchRef}
          id="website-companies-search"
          type="search"
          value={query}
          placeholder={k('searchPlaceholder')}
          autoComplete="off"
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="website-companies-filter">{k('filter')}</label>
        <select
          id="website-companies-filter"
          value={filter}
          onChange={(event) => onFilter(event.target.value)}
        >
          {FILTERS.map((name) => (
            <option key={name} value={name}>
              {k(`filter.${name}`, { count: counts[name] })}
            </option>
          ))}
        </select>
      </div>
      <Button variant="light" onClick={onClear} disabled={!query && filter === 'all'}>
        {k('clear')}
      </Button>
    </section>
  );
}
