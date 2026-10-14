import React from 'react';
import { DealEditor } from './DealEditor.jsx';
import { DealSplitDialog } from './DealSplitDialog.jsx';
import { EarnDealDialog } from './EarnDealDialog.jsx';
import { ReviseDealDialog } from './ReviseDealDialog.jsx';
import { UnearnDealDialog } from './UnearnDealDialog.jsx';
import { DealHandoverDialog } from './DealHandoverDialog.jsx';
import { MoveDealDialog } from './MoveDealDialog.jsx';
import { DeleteDealDialog } from './DeleteDealDialog.jsx';

const actionDialogs = {
  edit: DealEditor,
  split: DealSplitDialog,
  earn: EarnDealDialog,
  revise: ReviseDealDialog,
  unearn: UnearnDealDialog,
  handover: DealHandoverDialog,
  move: MoveDealDialog,
  delete: DeleteDealDialog,
};

/**
 * One action dialog stacked over the deal's details, so closing it returns focus to the
 * action that opened it. `onDone` runs after a successful change (delete closes everything).
 */
export function DealActionDialog({ action, deal, onClose, onDone }) {
  const Dialog = actionDialogs[action];
  return Dialog ? <Dialog deal={deal} onClose={onClose} onDone={onDone} /> : null;
}
