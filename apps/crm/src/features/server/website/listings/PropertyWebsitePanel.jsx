import React, { useContext, useId, useState } from 'react';
import { WorkspaceScopeContext } from '../../../../app/WorkspaceScopeContext.js';
import { Button } from '../../../../components/ui/Button.jsx';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useSession } from '../../../../hooks/useSession.js';
import {
  useRecords,
  useWorkspaceActions,
  useWorkspaceView,
} from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { actionCollection } from '../../access.js';
import { findEntry } from '../../assignment/assignmentModel.js';
import { PublishDialog } from '../publish/PublishDialog.jsx';
import { usePublishers } from '../publish/usePublishers.js';
import { publishedAt, recordWebsite } from './listingsModel.js';
import { useWebsiteListings } from './useWebsiteListings.js';
import { WithdrawListing } from './WithdrawListing.jsx';
import './website-listings.css';

/**
 * "Website" in a property's details (the only publishing entry for staff): whether it is
 * live, and Publish, Republish or Withdraw. Only in the caller's own company; staff without
 * a consented profile and publishing access see how to get them. The server decides all.
 */
export function PropertyWebsitePanel({ module, record }) {
  const { user } = useSession();
  const records = useRecords();
  const { owner } = useContext(WorkspaceScopeContext);
  const { readOnly = false } = useWorkspaceActions();
  const { setToast } = useWorkspaceView();
  const { t, format } = useI18n();
  const k = (key, vars) => t(`websiteListings.${key}`, vars);
  const headingId = useId();
  const [publishing, setPublishing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const workspace = user.workspaceId || user.id;
  const entry =
    actionCollection(module) === 'Properties'
      ? findEntry(records.entries, 'Properties', record)
      : null;
  const enabled =
    Boolean(entry) && !readOnly && owner?.id === workspace && user.roleId !== 'super-admin';
  const staff = user.roleId !== 'admin';
  const listings = useWebsiteListings(enabled);
  const own = usePublishers(undefined, enabled && staff);
  if (!enabled) return null;
  const website = recordWebsite(listings.publications, entry);
  const blocked = staff && !own.loading && !own.error && !own.eligible.length;
  const checking = listings.loading || (staff && own.loading);
  const error = listings.error || (staff && own.error);
  const ready = !checking && !error;
  const listed = website.status !== 'none';
  const status = {
    none: k('panelNone'),
    live: publishedAt(website.publication)
      ? k('panelLive', { date: format.date(publishedAt(website.publication)) })
      : k('panelLiveNoDate'),
    changed: k('panelChanged'),
  }[website.status];
  return (
    <section className="assignment-panel property-website-panel" aria-labelledby={headingId}>
      <div className="assignment-row">
        <span className="assignment-icon" aria-hidden="true">
          <Icon name="monitor" size={18} />
        </span>
        <div className="assignment-current">
          <h3 id={headingId}>{k('panelTitle')}</h3>
          <strong>{checking ? k('panelChecking') : error ? k('panelError') : status}</strong>
          {ready && website.live.length > 1 && (
            <small>{k('panelLiveCount', { count: website.live.length })}</small>
          )}
          {ready && blocked && <small>{k('panelBlocked')}</small>}
          {ready && !blocked && !listed && <small>{k('panelHint')}</small>}
        </div>
        {error && (
          <Button variant="light" onClick={listings.error ? listings.reload : own.retry}>
            {k('retry')}
          </Button>
        )}
        {ready && (!blocked || listed) && (
          <div className="property-website-actions">
            {!blocked && (
              <Button variant="light" disabled={listings.busy} onClick={() => setPublishing(true)}>
                {k(listed ? 'republish' : 'publishOnWebsite')}
              </Button>
            )}
            {listed && (
              <Button
                variant="danger-light"
                disabled={listings.busy}
                onClick={() => setWithdrawing(true)}
              >
                {k('withdraw')}
              </Button>
            )}
          </div>
        )}
      </div>
      {publishing && (
        <PublishDialog
          entry={entry}
          publication={website.publication}
          publications={listings.publications}
          onClose={() => setPublishing(false)}
          onStale={listings.reload}
          onPublished={() => {
            setPublishing(false);
            listings.reload();
            setToast(k('published'));
          }}
        />
      )}
      {withdrawing && website.publication && (
        <WithdrawListing
          title={website.publication.snapshot?.title || entry.record.listing_title}
          publication={website.publication}
          listings={listings}
          onClose={() => setWithdrawing(false)}
        />
      )}
    </section>
  );
}
