import React, { useId, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { readableDate } from '../../../lib/dates.js';
import { formatAed, formatPercent } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { feeBasisLabels, paymentStatusLabels } from './financeLabels.js';
import { holderName, referenceName } from './dealFilters.js';
import { detailFields } from './dealDraft.js';
import { DealCalculationPanel } from './DealCalculationPanel.jsx';
import { DealActions } from './DealActions.jsx';
import { DealActionDialog } from './DealActionDialog.jsx';

function Fact({ label, value, wide = false }) {
  return (
    <div className={'finance-fact' + (wide ? ' wide' : '')}>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

const fee = (deal) =>
  deal.feeBasis === 'fixed'
    ? `${feeBasisLabels.fixed} · ${formatAed(deal.fixedFeeFils)}`
    : `${feeBasisLabels.percentage} · ${formatPercent(deal.feeRateBp)}`;

/** A deal's shaped details, its calculation and the actions its `allowed` flags permit. */
export function DealDetails({ deal, onClose }) {
  const { overview, team, user } = useFinanceContext();
  const [action, setAction] = useState(null);
  const titleId = useId();
  const refs = overview.references;
  const client = referenceName(refs, 'Clients', deal.clientId);
  const property = referenceName(refs, 'Properties', deal.propertyId);
  const notes = detailFields.filter((field) => deal.details[field.key]);
  return (
    <Drawer className="detail-drawer finance-details" titleId={titleId} onClose={onClose}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">DEALS · DEAL DETAILS</div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {deal.dealId}
          </h2>
          <p>
            {client ? `${client} · ` : ''}
            {deal.dealType} · {deal.stage}
          </p>
        </div>
        <button className="icon-btn" aria-label="Close deal details" onClick={onClose}>
          <Icon name="close" size={21} />
        </button>
      </div>
      <div className="drawer-body">
        {deal.pendingHandover && (
          <p className="finance-note" role="note">
            <Icon name="users" size={16} /> A hand-over of this deal is waiting for a response.
          </p>
        )}
        <dl className="finance-facts">
          <Fact label="Client" value={client ? `${client} (${deal.clientId})` : deal.clientId} />
          <Fact
            label="Property"
            value={property ? `${property} (${deal.propertyId})` : deal.propertyId}
          />
          <Fact label="Holder" value={holderName(deal.assignee, user.id)} />
          <Fact label="Second agent" value={deal.secondAgent?.name} />
          <Fact label="Agreed value" value={formatAed(deal.agreedValueFils)} />
          <Fact label="Fee" value={fee(deal)} />
          <Fact
            label="Partner share"
            value={`${formatPercent(deal.partnerShareBp)}${deal.partnerName ? ` · ${deal.partnerName}` : ''}`}
          />
          <Fact label="Earned" value={deal.earnedOn ? readableDate(deal.earnedOn) : 'Not earned'} />
          <Fact label="Payment status" value={paymentStatusLabels[deal.paymentStatus]} />
          <Fact label="Received" value={formatAed(deal.receivedFils)} />
          <Fact label="Outstanding" value={formatAed(deal.outstandingFils)} />
        </dl>
        <DealCalculationPanel
          calculation={deal.calculation}
          team={team}
          override={deal.override}
          secondAgent={deal.secondAgent}
        />
        {notes.length > 0 && (
          <dl className="finance-facts finance-notes">
            {notes.map((field) => (
              <Fact
                key={field.key}
                label={field.label}
                value={deal.details[field.key]}
                wide={field.type === 'textarea'}
              />
            ))}
          </dl>
        )}
      </div>
      <DealActions deal={deal} onAction={setAction} onClose={onClose} />
      {action && (
        <DealActionDialog
          action={action}
          deal={deal}
          onClose={() => setAction(null)}
          onDone={action === 'delete' ? onClose : () => setAction(null)}
        />
      )}
    </Drawer>
  );
}
