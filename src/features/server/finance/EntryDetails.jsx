import React, { useId, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { referenceName } from './dealFilters.js';
import { entryCode, entryKinds } from './entryFilters.js';
import { historyTime } from './historyModel.js';
import { StatusChip } from './StatusChip.jsx';
import { ReceiptLink } from './ReceiptLink.jsx';
import { ApprovalActions } from './ApprovalActions.jsx';
import { FinanceHistory } from './FinanceHistory.jsx';

function Fact({ label, children, wide = false }) {
  return (
    <div className={'finance-fact' + (wide ? ' wide' : '')}>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

const editLabels = { rejected: 'Correct and resubmit', approved: 'Edit approved record' };

/** Facts for one payment or expense in the caller's shaped view. */
function EntryFacts({ kind, entry }) {
  const { overview } = useFinanceContext();
  const property = referenceName(overview.references, 'Properties', entry.propertyId);
  if (kind === 'payments')
    return (
      <>
        <Fact label="Deal">{entry.dealId}</Fact>
        <Fact label="Receipt date">{readableDate(entry.receiptDate)}</Fact>
        <Fact label="Amount (excluding VAT)">{formatAed(entry.amountFils)}</Fact>
        <Fact label="VAT">{formatAed(entry.vatFils)}</Fact>
        <Fact label="Total with VAT">{formatAed(entry.totalFils)}</Fact>
        <Fact label="Reference">{entry.reference}</Fact>
      </>
    );
  return (
    <>
      <Fact label="Incurred by">{entry.incurredBy.name}</Fact>
      <Fact label="Date paid">{readableDate(entry.datePaid)}</Fact>
      <Fact label="Amount">{formatAed(entry.amountFils)}</Fact>
      <Fact label="Category">{entry.category}</Fact>
      <Fact label="Supplier">{entry.supplier}</Fact>
      <Fact label="Campaign reference">{entry.campaignReference}</Fact>
      <Fact label="Property">
        {entry.propertyId && (property ? `${property} (${entry.propertyId})` : entry.propertyId)}
      </Fact>
      <Fact label="Receipt">
        <ReceiptLink url={entry.receiptUrl} />
      </Fact>
    </>
  );
}

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
      <div className="drawer-body">
        {entry.reason && ['rejected', 'void'].includes(entry.status) && (
          <p className="finance-note warning" role="note">
            <Icon name="info" size={16} />
            <span>
              {entry.status === 'rejected' ? 'Rejected' : 'Voided'}: {entry.reason}
            </span>
          </p>
        )}
        <dl className="finance-facts">
          <EntryFacts kind={kind} entry={entry} />
          <Fact label="Submitted by">{entry.submittedBy.name}</Fact>
          {entry.decidedBy && <Fact label="Decided by">{entry.decidedBy.name}</Fact>}
          <Fact label="Notes" wide>
            {entry.notes}
          </Fact>
        </dl>
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
