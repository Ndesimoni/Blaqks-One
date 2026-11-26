import { useState } from 'react';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { stageMoveBody } from './dealBoardModel.js';
import { useFinanceContext } from './useFinanceRequests.js';

/**
 * Moves a deal to another stage with the editor's own save (only the stage changed), as the
 * pipeline and the deal slider's "Move to …" do, then reports the result in a toast. The
 * server stays authoritative for earned-state rules and returns its recovery message.
 * `onSettled(deal)` runs after every attempt (the board puts focus back on the card).
 */
export function useDealStageMove({ onSettled } = {}) {
  const { t } = useI18n();
  const { actions } = useFinanceContext();
  const { setToast } = useWorkspaceView();
  const [saving, setSaving] = useState('');
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
      onSettled?.(deal);
    }
  };
  return { move, saving };
}
