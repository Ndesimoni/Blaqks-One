import React, { useId, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import '../../records/panel/record-panel.css';
import '../../records/panel/record-panel-body.css';
import { useFinanceContext } from './useFinanceRequests.js';
import { detailFields } from './dealDraft.js';
import { Fact } from './EntryFacts.jsx';
import { DealPanelHeader } from './DealPanelHeader.jsx';
import { DealFactsCard } from './DealFactsCard.jsx';
import { DealPaymentsCard } from './DealPaymentsCard.jsx';
import { DealCalculationPanel } from './DealCalculationPanel.jsx';
import { DealParties } from './DealParties.jsx';
import { DealActions } from './DealActions.jsx';
import { DealActionDialog } from './DealActionDialog.jsx';
import { FinanceHistory } from './FinanceHistory.jsx';
import { PaymentForm } from './PaymentForm.jsx';
import './deal-panel.css';

/**
 * A deal's shaped details (finance-design §7) as the approved mockup's record slider: the
 * header with Record payment, Move to the next stage and the stage bar; the facts and the
 * commission split on the left, payments and history on the right; then the client and
 * listing and the notes. The footer keeps every action the row's `allowed` flags permit.
 */
export function DealDetails({ deal, onClose }) {
  const { team } = useFinanceContext();
  const { t } = useI18n();
  const [action, setAction] = useState(null);
  const [paying, setPaying] = useState(false);
  const titleId = useId();
  const subtitleId = useId();
  const notesId = useId();
  // The target close date already reads in the facts card.
  const notes = detailFields.filter(
    (field) => field.key !== 'target_close_date' && deal.details[field.key],
  );
  return (
    // The slider's name is the deal's name with its kind, client and ID.
    <Drawer
      className="detail-drawer record-panel deal-panel"
      placement="right"
      titleId={`${titleId} ${subtitleId}`}
      onClose={onClose}
    >
      <DealPanelHeader
        deal={deal}
        titleId={titleId}
        subtitleId={subtitleId}
        onClose={onClose}
        onRecordPayment={() => setPaying(true)}
      />
      <div className="drawer-body record-panel-body finance-details-body deal-panel-body">
        {deal.pendingHandover && (
          <p className="finance-note warning" role="note">
            <Icon name="users" size={16} /> {t('dealPanel.handoverWaiting')}
          </p>
        )}
        <div className="record-panel-columns">
          <div className="record-panel-main">
            <DealFactsCard deal={deal} />
            <DealCalculationPanel
              calculation={deal.calculation}
              team={team}
              override={deal.override}
              secondAgent={deal.secondAgent}
            />
          </div>
          <div className="record-panel-side">
            <DealPaymentsCard deal={deal} />
            <FinanceHistory kind="deals" row={deal} />
          </div>
        </div>
        <DealParties deal={deal} />
        {notes.length > 0 && (
          <section className="finance-detail-section deal-notes" aria-labelledby={notesId}>
            <h3 id={notesId}>{t('dealPanel.notes')}</h3>
            <dl className="finance-facts">
              {notes.map((field) => (
                <Fact key={field.key} label={field.label} wide={field.type === 'textarea'}>
                  {deal.details[field.key]}
                </Fact>
              ))}
            </dl>
          </section>
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
      {paying && (
        <PaymentForm
          dealId={deal.dealId}
          onClose={() => setPaying(false)}
          onDone={() => setPaying(false)}
        />
      )}
    </Drawer>
  );
}
