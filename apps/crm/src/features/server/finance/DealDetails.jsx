import React, { useId, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { readableDate } from '../../../lib/dates.js';
import { formatAed, formatPercent } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { feeBasisLabels } from './financeLabels.js';
import { holderName, referenceName } from './dealFilters.js';
import { detailFields } from './dealDraft.js';
import { Fact } from './EntryFacts.jsx';
import { StageChip } from './DealChips.jsx';
import { DealSummary } from './DealSummary.jsx';
import { DealCalculationPanel } from './DealCalculationPanel.jsx';
import { DealParties } from './DealParties.jsx';
import { DealActions } from './DealActions.jsx';
import { DealActionDialog } from './DealActionDialog.jsx';
import { FinanceHistory } from './FinanceHistory.jsx';

const fee = (deal) =>
  deal.feeBasis === 'fixed'
    ? `${feeBasisLabels.fixed} · ${formatAed(deal.fixedFeeFils)}`
    : `${feeBasisLabels.percentage} · ${formatPercent(deal.feeRateBp)}`;

const withId = (name, id) => (name ? `${name} (${id})` : id);

/**
 * A deal's shaped details (finance-design §7), in reading order: the headline figures, the
 * commission split, the deal's facts, notes and history, then the actions its `allowed`
 * flags permit.
 */
export function DealDetails({ deal, onClose }) {
  const { overview, team, user } = useFinanceContext();
  const [action, setAction] = useState(null);
  const titleId = useId();
  const refs = overview.references;
  const client = referenceName(refs, 'Clients', deal.clientId);
  const property = referenceName(refs, 'Properties', deal.propertyId);
  const notes = detailFields.filter((field) => deal.details[field.key]);
  return (
    <Drawer
      className="detail-drawer finance-details deal-details"
      titleId={titleId}
      onClose={onClose}
    >
      <div className="drawer-top">
        <div>
          <div className="eyebrow">DEALS · DEAL DETAILS</div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {deal.dealId}
          </h2>
          <p className="deal-details-context">
            <StageChip stage={deal.stage} />
            <span>
              {client ? `${client} · ` : ''}
              {deal.dealType}
            </span>
          </p>
        </div>
        <button className="icon-btn" aria-label="Close deal details" onClick={onClose}>
          <Icon name="close" size={21} />
        </button>
      </div>
      <div className="drawer-body finance-details-body deal-details-body">
        {deal.pendingHandover && (
          <p className="finance-note warning" role="note">
            <Icon name="users" size={16} /> A hand-over of this deal is waiting for a response.
          </p>
        )}
        <DealSummary deal={deal} team={team} />
        <DealParties deal={deal} />
        <DealCalculationPanel
          calculation={deal.calculation}
          team={team}
          override={deal.override}
          secondAgent={deal.secondAgent}
        />
        <section className="finance-detail-section" aria-labelledby={`${titleId}-facts`}>
          <h3 id={`${titleId}-facts`}>Deal</h3>
          <dl className="finance-facts">
            <Fact label="Client">{withId(client, deal.clientId)}</Fact>
            <Fact label="Property">{deal.propertyId && withId(property, deal.propertyId)}</Fact>
            <Fact label="Holder">{holderName(deal.assignee, user.id)}</Fact>
            <Fact label="Second agent">{deal.secondAgent?.name}</Fact>
            <Fact label="Fee">{fee(deal)}</Fact>
            <Fact label="Partner share">
              {`${formatPercent(deal.partnerShareBp)}${deal.partnerName ? ` · ${deal.partnerName}` : ''}`}
            </Fact>
            <Fact label="Earned">{deal.earnedOn ? readableDate(deal.earnedOn) : 'Not earned'}</Fact>
          </dl>
        </section>
        {notes.length > 0 && (
          <section className="finance-detail-section" aria-labelledby={`${titleId}-notes`}>
            <h3 id={`${titleId}-notes`}>Notes</h3>
            <dl className="finance-facts">
              {notes.map((field) => (
                <Fact key={field.key} label={field.label} wide={field.type === 'textarea'}>
                  {deal.details[field.key]}
                </Fact>
              ))}
            </dl>
          </section>
        )}
        <FinanceHistory kind="deals" row={deal} />
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
