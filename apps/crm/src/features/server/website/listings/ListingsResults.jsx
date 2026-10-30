import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { Empty } from '../../../../components/ui/Empty.jsx';
import { Pagination } from '../../../../components/ui/Pagination.jsx';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { ListingCards } from './ListingCards.jsx';
import { ListingsTable } from './ListingsTable.jsx';
import { PAGE_SIZE } from './listingsModel.js';
import './website-listing-cards.css';

function Skeleton({ label }) {
  return (
    <section className="panel website-listings-skeleton">
      <p className="sr-only" role="status">
        {label}
      </p>
      {[0, 1, 2].map((row) => (
        <div className="website-skeleton-row" key={row} aria-hidden="true">
          <span className="website-skeleton website-skeleton-line" />
          <span className="website-skeleton website-skeleton-line short" />
          <span className="website-skeleton website-skeleton-chip" />
        </div>
      ))}
    </section>
  );
}

/**
 * Loading rows, a recovery panel, "no listings yet" (with Publish) versus "no matches"
 * (with Clear filters), then 12 listings per page: a table on wide screens, cards on phones.
 */
export function ListingsResults({
  state,
  rows,
  filtered,
  page,
  onPage,
  onClear,
  onPublish,
  ...rest
}) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteListings.${key}`, vars);
  const mobile = useMediaQuery('(max-width: 850px)');
  if (state.loading) return <Skeleton label={k('loading')} />;
  if (state.error)
    return (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{state.error}</p>
        <Button variant="light" onClick={state.retry}>
          {k('retry')}
        </Button>
      </section>
    );
  if (!rows.length)
    return (
      <section className="panel website-listings-empty">
        <Empty
          icon="building"
          title={k('emptyTitle')}
          detail={k('emptyDetail')}
          action={
            <Button icon="plus" onClick={onPublish}>
              {k('publish')}
            </Button>
          }
        />
      </section>
    );
  if (!filtered.length)
    return (
      <section className="panel website-listings-empty">
        <Empty
          icon="search"
          title={k('noMatchesTitle')}
          detail={k('noMatchesDetail')}
          action={
            <Button variant="light" onClick={onClear}>
              {k('clearFilters')}
            </Button>
          }
        />
      </section>
    );
  const shown = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return (
    <>
      {mobile ? <ListingCards rows={shown} {...rest} /> : <ListingsTable rows={shown} {...rest} />}
      <Pagination
        total={filtered.length}
        page={page}
        pageSize={PAGE_SIZE}
        label={k('pagesLabel')}
        itemLabel={k('itemLabel')}
        onChange={onPage}
      />
    </>
  );
}
