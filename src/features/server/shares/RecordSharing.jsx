import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { schema } from '../../../lib/schema.js';
import { actionCollection } from '../access.js';
import { findEntry } from '../assignment/assignmentModel.js';
import { canShareRecord, shareCollections } from './shareModel.js';
import { useRecordShares } from './useShareReads.js';
import { RecordShareList } from './RecordShareList.jsx';
import { ShareDialog } from './ShareDialog.jsx';
import './record-shares.css';

const open = (share) => ['pending', 'accepted'].includes(share.status);

/**
 * Sharing in record details (record sharing R1): the holder or the company Admin offers a
 * view-only copy to one colleague and sees the record's shares with Withdraw or Stop sharing.
 * Copies and records the caller only sees are not offered; the server decides every request.
 */
export function RecordSharing({ module, record }) {
  const collection = actionCollection(module);
  const { user } = useSession();
  const records = useRecords();
  const { readOnly = false } = useWorkspaceActions();
  const { t } = useI18n();
  const k = (key, vars) => t(`recordShares.${key}`, vars);
  const headingId = useId();
  const [sharing, setSharing] = useState(false);
  const entry = shareCollections.includes(collection)
    ? findEntry(records.entries, collection, record)
    : null;
  const enabled = !readOnly && canShareRecord(user, entry);
  const shares = useRecordShares(enabled ? entry.id : null);
  if (!enabled) return null;
  const id = record[schema(collection)[0].key];
  const count = shares.shares.filter(open).length;
  return (
    <section className="assignment-panel record-sharing" aria-labelledby={headingId}>
      <div className="assignment-row">
        <span className="assignment-icon" aria-hidden="true">
          <Icon name="link" size={18} />
        </span>
        <div className="assignment-current">
          <h3 id={headingId}>{k('sectionTitle')}</h3>
          <strong>{count ? k('sectionCount', { count }) : k('notShared')}</strong>
          <small>{k('sectionHint')}</small>
        </div>
        <Button
          variant="light"
          icon="users"
          aria-label={k('shareLabel', { id })}
          onClick={() => setSharing(true)}
        >
          {k('share')}
        </Button>
      </div>
      <RecordShareList state={shares} />
      {sharing && (
        <ShareDialog
          collection={collection}
          recordId={entry.id}
          onSent={shares.reload}
          onClose={() => setSharing(false)}
        />
      )}
    </section>
  );
}
