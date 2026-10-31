import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { LISTING_FILTERS } from './listingsModel.js';

function siteNotice(site) {
  if (site === null) return 'siteMissing';
  if (site && !site.licenceVerified) return 'licenceMissing';
  return '';
}

/**
 * Title, the one primary action (Publish a property; without `onPublish` the empty state
 * offers it instead), a site notice when publishing cannot succeed yet, the Live/Withdrawn/All
 * filter, title search and the active-filter summary.
 */
export function ListingsToolbar({ titleId, site, filters, count, busy, onFilters, onPublish }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteListings.${key}`, vars);
  const notice = siteNotice(site);
  const searching = Boolean(filters.query.trim());
  return (
    <>
      <div className="website-listings-head">
        <div>
          <h2 id={titleId}>{k('title')}</h2>
          <p>{k('intro')}</p>
        </div>
        {onPublish && (
          <Button icon="plus" disabled={busy} onClick={onPublish}>
            {k('publish')}
          </Button>
        )}
      </div>
      {notice && (
        <p className="website-listings-notice" role="note">
          {k(notice)}
        </p>
      )}
      <div className="filters-toolbar website-listings-filters">
        <div className="tabs" role="group" aria-label={k('filterLabel')}>
          {LISTING_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filters.status === status}
              className={filters.status === status ? 'active' : ''}
              onClick={() => onFilters({ ...filters, status })}
            >
              {k(`filter.${status}`)}
            </button>
          ))}
        </div>
        <div className="search-small website-listings-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            aria-label={k('search')}
            placeholder={k('searchPlaceholder')}
            value={filters.query}
            onChange={(event) => onFilters({ ...filters, query: event.target.value })}
          />
        </div>
      </div>
      {searching && (
        <p className="website-listings-count" role="status">
          {k('matches', { count })}
        </p>
      )}
    </>
  );
}
