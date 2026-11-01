import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { KanbanBoard } from '../../../components/ui/kanban/KanbanBoard.jsx';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dealColumns, stageMoveBody } from './dealBoardModel.js';
import { DealCardBody } from './DealCardBody.jsx';
import { useFinanceContext } from './useFinanceRequests.js';
import './deal-board.css';

/**
 * The Deals pipeline (NAV): the filtered deals in one column per stage. A move sends the
 * editor's own save with only the stage changed, so it is offered exactly where Edit deal is
 * (`editDeal` access and the row's server-computed `allowed`). The server remains authoritative
 * for earned-state transitions and returns the existing Unearn-first recovery message.
 */
export function DealsBoard({ deals, total, stage, onOpen, onAdd, onReset }) {
  const { t } = useI18n();
  const { actions, readOnly } = useFinanceContext();
  const { setToast } = useWorkspaceView();
  const [saving, setSaving] = useState('');
  const [focusRequest, setFocusRequest] = useState(null);
  const sequence = useRef(0);
  const canMove = (deal) => !readOnly && actions.can('editDeal', deal);
  const move = async (deal, stage) => {
    const body = stageMoveBody(deal, stage);
    if (!body || saving || actions.busy) return;
    setSaving(deal.id);
    try {
      const result = await actions.saveDeal(body, deal);
      setToast(
        result.ok
          ? t('dealsBoard.moved', { id: deal.dealId, stage })
          : result.message || t('dealsBoard.failed', { id: deal.dealId }),
      );
    } catch (error) {
      setToast(error?.message || t('dealsBoard.failed', { id: deal.dealId }));
    } finally {
      setSaving('');
      setFocusRequest({ key: deal.id, sequence: ++sequence.current });
    }
  };
  const filtered = total > 0;
  return (
    <KanbanBoard
      label={t('dealsBoard.label')}
      columns={dealColumns(deals, stage)}
      itemKey={(deal) => deal.id}
      canMove={canMove}
      moveLabel={(deal) => t('dealsBoard.move', { id: deal.dealId })}
      onMove={move}
      busy={Boolean(saving || actions.busy)}
      focusRequest={focusRequest}
      emptyTitle={filtered ? t('dealsBoard.noMatch') : t('dealsBoard.none')}
      emptyDetail={filtered ? t('dealsBoard.noMatchDetail') : t('dealsBoard.noneDetail')}
      emptyAction={
        filtered && onReset ? (
          <Button variant="light" onClick={onReset}>
            {t('dealsBoard.clear')}
          </Button>
        ) : !filtered && onAdd ? (
          <Button onClick={onAdd}>Add deal</Button>
        ) : null
      }
      renderCard={(deal) => <DealCardBody deal={deal} onOpen={() => onOpen(deal)} />}
    />
  );
}
