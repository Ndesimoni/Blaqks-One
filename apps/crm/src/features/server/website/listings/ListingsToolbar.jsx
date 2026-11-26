import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { GridFilterBar } from '../../../records/grid/GridFilterBar.jsx';
import '../../../records/grid/grid-filter.css';
import { useI18n } from '../../../../i18n/useI18n.js';
import { LISTING_FILTERS } from './listingsModel.js';

function siteNotice(site) {
  if (site === null) return 'siteMissing';
  if (site && !site.licenceVerified) return 'licenceMissing';
  return '';
}

/**
 * The approved mockup's listings toolbar (design queue item 23): the live count with Publish a
 * property, a site notice when publishing cannot succeed yet, then the grid's filter row (Live,
 * Changes not public, then Withdrawn and All) with title search.
 */
export function ListingsToolbar({
  titleId,
  site,
  filters,
  count,
  live,
  busy,
  onFilters,
  onPublish,
}) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteListings.${key}`, vars);
  const notice = siteNotice(site);
  const searching = Boolean(filters.query.trim());
  const tabs = LISTING_FILTERS.map((status) => k(`filter.${status}`));
  const label = k(`filter.${filters.status}`);
  return (
    <>
      <h2 id={titleId} className="sr-only">
        {k('title')}
      </h2>
      <div className="website-listings-head">
        <p className="acct-muted">{k('liveCount', { count: live })}</p>
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
      <GridFilterBar
        module={k('module')}
        presetLabel={label}
        tabs={tabs}
        tab={label}
        onTab={(name) => onFilters({ ...filters, status: LISTING_FILTERS[tabs.indexOf(name)] })}
        query={filters.query}
        onQuery={(query) => onFilters({ ...filters, query })}
        placeholder={k('searchPlaceholder')}
      />
      {searching && (
        <p className="website-listings-count" role="status">
          {k('matches', { count })}
        </p>
      )}
    </>
  );
}
