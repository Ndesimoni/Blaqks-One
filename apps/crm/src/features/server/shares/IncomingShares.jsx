import React, { useId, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { shareCollections, waitingFor } from './shareModel.js';
import { useShareActions } from './useShareActions.js';
import { useShareList } from './useShareReads.js';
import { IncomingShareRow } from './IncomingShareRow.jsx';
import './record-shares.css';

/**
 * "Shared with you" at the top of Leads, Clients, Properties and Contacts (record sharing
 * R1): pending offers of that collection with Accept and Decline. Accepting reloads the
 * record list, so the view-only copy shows below with its badge. Only staff receive shares.
 */
export function IncomingShares({ collection }) {
  const { user } = useSession();
  const { refresh } = useRecords();
  const { t } = useI18n();
  const k = (key, vars) => t(`recordShares.${key}`, vars);
  const headingId = useId();
  const enabled = shareCollections.includes(collection) && user?.roleId === 'staff';
  const list = useShareList(enabled);
  const { busy, decide } = useShareActions(refresh);
  const [notice, setNotice] = useState(null);
  const waiting = waitingFor(list.value, collection);
  if (!enabled || (!waiting.length && !notice)) return null;
  const answer = async (share, action) => {
    setNotice(null);
    const result = await decide(share, action);
    const label = share.label || k('noLabel');
    if (result.ok)
      setNotice({
        role: 'status',
        text: k(action === 'accept' ? 'accepted' : 'declined', { label }),
      });
    else if (result.message) setNotice({ role: 'alert', text: result.message });
    list.reload();
  };
  return (
    <section className="panel record-shares-incoming" aria-labelledby={headingId}>
      <div className="record-shares-head">
        <h2 id={headingId}>{k('incomingTitle')}</h2>
        {waiting.length > 0 && (
          <span className="record-shares-count">
            {k('incomingCount', { count: waiting.length })}
          </span>
        )}
      </div>
      {notice && (
        <p
          className={notice.role === 'alert' ? 'field-error' : 'record-share-done'}
          role={notice.role}
        >
          {notice.text}
        </p>
      )}
      {waiting.length > 0 && (
        <ul className="record-shares-list">
          {waiting.map((share) => (
            <IncomingShareRow key={share.id} share={share} busy={Boolean(busy)} onAnswer={answer} />
          ))}
        </ul>
      )}
    </section>
  );
}
