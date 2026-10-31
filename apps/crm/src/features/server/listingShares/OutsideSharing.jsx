import React, { useContext, useId, useState } from 'react';
import { WorkspaceScopeContext } from '../../../app/WorkspaceScopeContext.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { actionCollection } from '../access.js';
import { findEntry } from '../assignment/assignmentModel.js';
import { canShareRecord } from '../shares/shareModel.js';
import { OutsideShareDialog } from './OutsideShareDialog.jsx';
import { OutsideShareList } from './OutsideShareList.jsx';
import { useRecordListingShares } from './useListingShares.js';
import './listing-shares.css';

const open = (share) => ['pending', 'accepted'].includes(share.status);

/**
 * "Other companies" in a listing's details (record sharing R2): its holder or the company
 * Admin shares it, view only and until a chosen day, with one named agent at another
 * company, and sees the listing's outside shares with Withdraw, Stop sharing, Extend and
 * the evidence. Only for the caller's own company; the server decides every request.
 */
export function OutsideSharing({ module, record }) {
  const collection = actionCollection(module);
  const { user } = useSession();
  const records = useRecords();
  const { owner } = useContext(WorkspaceScopeContext);
  const { readOnly = false } = useWorkspaceActions();
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShares.${key}`, vars);
  const headingId = useId();
  const [sharing, setSharing] = useState(false);
  const entry = collection === 'Properties' ? findEntry(records.entries, collection, record) : null;
  const enabled = !readOnly && owner.id === user.workspaceId && canShareRecord(user, entry);
  const shares = useRecordListingShares(enabled ? entry.id : null);
  if (!enabled) return null;
  const count = shares.shares.filter(open).length;
  return (
    <section
      className="assignment-panel record-sharing outside-sharing"
      aria-labelledby={headingId}
    >
      <div className="assignment-row">
        <span className="assignment-icon" aria-hidden="true">
          <Icon name="building" size={18} />
        </span>
        <div className="assignment-current">
          <h3 id={headingId}>{k('sectionTitle')}</h3>
          <strong>{count ? k('sectionCount', { count }) : k('notShared')}</strong>
          <small>{k('sectionHint')}</small>
        </div>
        <Button variant="light" icon="external" onClick={() => setSharing(true)}>
          {k('share')}
        </Button>
      </div>
      <OutsideShareList state={shares} />
      {sharing && (
        <OutsideShareDialog
          recordId={entry.id}
          onSent={shares.reload}
          onClose={() => setSharing(false)}
        />
      )}
    </section>
  );
}
