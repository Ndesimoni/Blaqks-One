import React from 'react';
import { useFinanceContext } from './useFinanceRequests.js';
import { FinanceDialog } from './FinanceDialog.jsx';
import { EntryDetails } from './EntryDetails.jsx';
import { PaymentForm } from './PaymentForm.jsx';
import { ExpenseForm } from './ExpenseForm.jsx';
import { RejectDialog } from './RejectDialog.jsx';
import { VoidDialog } from './VoidDialog.jsx';
import { entryKinds } from './entryFilters.js';

export const closedEntryDialogs = Object.freeze({ details: null, action: null });

const forms = { payments: PaymentForm, expenses: ExpenseForm };

/**
 * The page's stacked dialogs: a row's details and, above them, one action (add, edit or
 * resubmit, reject, void). Rows are read from the overview by ID on every render, so after a
 * refresh the dialogs submit the latest version while keeping what the user typed; a row that
 * left the caller's view shows "no longer available" instead.
 */
export function EntryDialogs({ kind, dialog, setDialog }) {
  const { overview } = useFinanceContext();
  const rows = overview[kind];
  const find = (id) => rows.find((row) => row.id === id) ?? null;
  const details = dialog.details ? find(dialog.details) : null;
  const action = dialog.action;
  const target = action?.id ? find(action.id) : null;
  const closeAction = () => setDialog((current) => ({ ...current, action: null }));
  const closeAll = () => setDialog(closedEntryDialogs);
  const openAction = (type, entry) =>
    setDialog((current) => ({ ...current, action: { type, id: entry.id } }));
  const Form = forms[kind];
  const gone = (Boolean(dialog.details) && !details) || (Boolean(action?.id) && !target);
  if (gone)
    return (
      <FinanceDialog
        eyebrow={entryKinds[kind].eyebrow}
        title={`${entryKinds[kind].title} unavailable`}
        onClose={closeAll}
      >
        <p>This record is no longer available to you.</p>
      </FinanceDialog>
    );
  return (
    <>
      {details && (
        <EntryDetails kind={kind} entry={details} onClose={closeAll} onDialog={openAction} />
      )}
      {action?.type === 'create' && <Form onClose={closeAction} onDone={closeAction} />}
      {action?.type === 'edit' && target && (
        <Form
          {...{ [kind === 'payments' ? 'payment' : 'expense']: target }}
          onClose={closeAction}
          onDone={closeAction}
        />
      )}
      {action?.type === 'reject' && target && (
        <RejectDialog kind={kind} entry={target} onClose={closeAction} />
      )}
      {action?.type === 'void' && target && (
        <VoidDialog kind={kind} entry={target} onClose={closeAction} />
      )}
    </>
  );
}
