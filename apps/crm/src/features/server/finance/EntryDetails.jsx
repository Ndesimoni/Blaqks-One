import React, { useId, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useFinanceContext } from './useFinanceRequests.js';
import { entryCode, entryKinds } from './entryFilters.js';
import { historyTime } from './historyModel.js';
import { StatusChip } from './StatusChip.jsx';
import { ApprovalActions } from './ApprovalActions.jsx';
import { FinanceHistory } from './FinanceHistory.jsx';
import { EntryAmount, EntryFacts, Fact } from './EntryFacts.jsx';

const editLabels = { rejected: 'Correct and resubmit', approved: 'Edit approved record' };

/**
 * One payment or expense (finance-design §4, §7): status as text, the decision reason shown to
 * everyone who sees the row, its facts, history, and the actions its `allowed` flags permit.
 * Rejected rows offer "Correct and resubmit"; only the Admin edits or voids approved rows.
 */
export function EntryDetails({ kind, entry, onClose, onDialog }) {
  const { actions } = useFinanceContext();
  const [message, setMessage] = useState('');
  const titleId = useId();
  const code = entryCode(entry);
  const decided = entry.status !== 'pending' && entry.decidedAt;
  return (
    <Drawer className="detail-drawer finance-details" titleId={titleId} onClose={onClose}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">{entryKinds[kind].eyebrow} · DETAILS</div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {code}
          </h2>
          <p className="finance-entry-status">
            <StatusChip status={entry.status} />
            {decided && <span className="finance-sub">{historyTime(entry.decidedAt)}</span>}
          </p>
        </div>
        <button className="icon-btn" aria-label={`Close ${code} details`} onClick={onClose}>
          <Icon name="close" size={21} />
        </button>
      </div>
      <div className="drawer-body finance-details-body">
        {entry.reason && ['rejected', 'void'].includes(entry.status) && (
          <p className="finance-note warning" role="note">
            <Icon name="info" size={16} />
            <span>
              {entry.status === 'rejected' ? 'Rejected' : 'Voided'}: {entry.reason}
            </span>
          </p>
        )}
        <EntryAmount kind={kind} entry={entry} />
        <section className="finance-detail-section" aria-labelledby={`${titleId}-facts`}>
          <h3 id={`${titleId}-facts`}>Details</h3>
          <dl className="finance-facts">
            <EntryFacts kind={kind} entry={entry} />
            <Fact label="Submitted by">{entry.submittedBy.name}</Fact>
            {entry.decidedBy && <Fact label="Decided by">{entry.decidedBy.name}</Fact>}
            <Fact label="Notes" wide>
              {entry.notes}
            </Fact>
          </dl>
        </section>
        {message && (
          <p className="field-error" role="alert">
            {message}
          </p>
        )}
        <FinanceHistory kind={kind} row={entry} />
      </div>
      <div className="drawer-footer finance-details-footer">
        <div className="finance-action-group">
          <Button variant="light" onClick={onClose}>
            Close
          </Button>
          {actions.can('editEntry', entry) && (
            <Button variant="light" icon="edit" onClick={() => onDialog('edit', entry)}>
              {editLabels[entry.status] ?? 'Edit'}
            </Button>
          )}
        </div>
        <ApprovalActions kind={kind} entry={entry} onDialog={onDialog} onMessage={setMessage} />
      </div>
    </Drawer>
  );
}
