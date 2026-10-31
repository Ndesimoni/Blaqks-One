import React, { useId, useMemo, useState } from 'react';
import {
  useRecords,
  useWorkspaceActions,
  useWorkspaceView,
} from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { PublishDialog } from '../publish/PublishDialog.jsx';
import { profileName } from '../publish/publishModel.js';
import { usePublishers } from '../publish/usePublishers.js';
import { filterListings, listingRows, PAGE_SIZE } from './listingsModel.js';
import { ListingsResults } from './ListingsResults.jsx';
import { ListingsToolbar } from './ListingsToolbar.jsx';
import { useWebsiteListings } from './useWebsiteListings.js';
import { WithdrawListing } from './WithdrawListing.jsx';
import './website-listings.css';

const initialFilters = { query: '', status: 'live' };

/**
 * The Admin's Website → Properties tab: every company publication with its public price,
 * agent and status, 12 per page. "Changes not public" marks a CRM record edited since it was
 * published. `site` is the company site from the Content editor (null when none is saved).
 */
export function WebsiteListings({ site }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteListings.${key}`, vars);
  const records = useRecords();
  const { dispatchRow, readOnly } = useWorkspaceActions();
  const { setToast } = useWorkspaceView();
  const listings = useWebsiteListings();
  const publishers = usePublishers(site);
  const titleId = useId();
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(0);
  const [publishing, setPublishing] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const rows = useMemo(
    () => listingRows(listings.publications, records.entries),
    [listings.publications, records.entries],
  );
  const filtered = useMemo(() => filterListings(rows, filters), [rows, filters]);
  const current = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const agentName = (row) =>
    profileName(publishers.profiles.find((p) => p.id === row.publication.agentProfileId)) ||
    k('agentUnknown');
  const changeFilters = (next) => {
    setFilters(next);
    setPage(0);
  };
  const state = {
    loading: listings.loading || records.loading,
    error: listings.error || records.error,
    retry: listings.error ? listings.reload : records.retry,
  };
  // With no listings at all the empty state carries the one Publish action.
  const publishInHead = !state.loading && Boolean(state.error || rows.length);
  const actions = {
    busy: listings.busy,
    onOpen: (row) => dispatchRow('Properties', row.entry.record),
    onRepublish: (row) => setPublishing({ entry: row.entry, publication: row.publication }),
    onWithdraw: (row) => setWithdrawing(row),
  };
  return (
    <section className="website-listings" aria-labelledby={titleId}>
      <ListingsToolbar
        titleId={titleId}
        site={site}
        filters={filters}
        count={filtered.length}
        busy={readOnly}
        onFilters={changeFilters}
        onPublish={publishInHead ? () => setPublishing({}) : null}
      />
      <ListingsResults
        state={state}
        rows={rows}
        filtered={filtered}
        page={current}
        onPage={setPage}
        onClear={() => changeFilters({ query: '', status: 'all' })}
        onPublish={() => setPublishing({})}
        agentName={agentName}
        actions={actions}
      />
      {publishing && (
        <PublishDialog
          entry={publishing.entry}
          publication={publishing.publication}
          publications={listings.publications}
          site={site}
          onClose={() => setPublishing(null)}
          onStale={listings.reload}
          onPublished={() => {
            setPublishing(null);
            listings.reload();
            setToast(k('published'));
          }}
        />
      )}
      {withdrawing && (
        <WithdrawListing
          title={withdrawing.title}
          publication={withdrawing.publication}
          listings={listings}
          onClose={() => setWithdrawing(null)}
        />
      )}
    </section>
  );
}
