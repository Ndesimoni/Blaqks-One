import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { StageTrack } from '../../records/panel/StageTrack.jsx';
import '../../records/panel/record-panel-head.css';
import { dealPipeline, nextDealStage } from './dealBoardModel.js';
import { FigureChip, PaymentChip } from './DealChips.jsx';
import { dealTitle, referenceName } from './dealFilters.js';
import { useDealStageMove } from './useDealStageMove.js';
import { useFinanceContext } from './useFinanceRequests.js';

/**
 * The deal slider's header (approved mockup): close, the deal's name over "Deal · client ·
 * ID", Record payment (an earned deal, for people who may record one) and Move to the next
 * pipeline stage (where Edit deal is allowed), the payment and figure chips, then the stage
 * bar. Move is the primary action unless the footer offers Mark earned.
 */
export function DealPanelHeader({ deal, titleId, subtitleId, onClose, onRecordPayment }) {
  const { t } = useI18n();
  const { overview, actions, readOnly } = useFinanceContext();
  const { move, saving } = useDealStageMove();
  const k = (key, vars) => t(`dealPanel.${key}`, vars);
  const refs = overview.references;
  const client = referenceName(refs, 'Clients', deal.clientId) ?? deal.clientId;
  const next = !readOnly && actions.can('editDeal', deal) ? nextDealStage(deal.stage) : '';
  const pay = !readOnly && deal.earnedOn && actions.can('createEntry');
  return (
    <header className="drawer-top record-panel-head deal-panel-head">
      <button
        type="button"
        className="icon-btn record-panel-close"
        aria-label={k('close')}
        onClick={onClose}
      >
        <Icon name="close" size={20} />
      </button>
      <div className="record-panel-identity">
        <div className="record-panel-title">
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {dealTitle(deal, refs)}
          </h2>
          <p id={subtitleId}>{[k('kind'), client, deal.dealId].join(' · ')}</p>
        </div>
      </div>
      {(pay || next) && (
        <div className="record-panel-actions" role="group" aria-label={k('shortcuts')}>
          {pay && (
            <Button variant="light" icon="wallet" onClick={onRecordPayment}>
              {k('recordPayment')}
            </Button>
          )}
          {next && (
            <Button
              variant={actions.can('earnDeal', deal) ? 'light' : 'primary'}
              icon="arrow"
              disabled={Boolean(saving) || actions.busy}
              onClick={() => move(deal, next)}
            >
              {k('moveTo', { stage: next })}
            </Button>
          )}
        </div>
      )}
      <div className="record-panel-status">
        <PaymentChip status={deal.paymentStatus} />
        <FigureChip calculation={deal.calculation} />
      </div>
      <StageTrack value={deal.stage} stages={dealPipeline} labelKey="dealPanel.stageTrack" />
    </header>
  );
}
