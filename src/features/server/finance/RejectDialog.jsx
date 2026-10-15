import React, { useId, useState } from 'react';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { reasonError } from './financeRules.js';
import { entryCode, entryKinds } from './entryFilters.js';
import { StatusChip } from './StatusChip.jsx';

/**
 * A decision that needs a reason (reject or void, finance-design §4). The reason is shown to
 * everyone who sees the row and kept in history; on a refusal or conflict it stays typed.
 * `entry` is the latest row from the overview, so a retry after a 409 uses its new version.
 */
export function ReasonDecisionDialog({
  kind,
  entry,
  decision,
  title,
  intro,
  submitLabel,
  onClose,
}) {
  const { actions } = useFinanceContext();
  const id = useId();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const words = entryKinds[kind];
  const close = () => {
    if (reason.trim() && !confirm('Discard your unsaved changes?')) return;
    onClose();
  };
  const submit = async () => {
    setMessage('');
    const result = await actions.decideEntry(kind, entry, decision, reason);
    if (result.ok) return onClose();
    setMessage(failureText(result, 'record'));
  };
  return (
    <FinanceDialog
      eyebrow={`${words.eyebrow} · ${entryCode(entry)}`}
      title={title}
      intro={intro}
      busy={actions.busy}
      message={message}
      onClose={close}
      onSubmit={submit}
      submitLabel={submitLabel}
      submitDisabled={Boolean(reasonError(reason))}
      danger={decision === 'void'}
    >
      <p className="finance-dialog-status">
        Current status <StatusChip status={entry.status} />
      </p>
      <ReasonField
        id={`${id}-reason`}
        value={reason}
        onChange={setReason}
        hint="Everyone who can see this record will see the reason."
      />
    </FinanceDialog>
  );
}

/** Reject a pending payment or expense with a reason; the submitter can correct and resubmit. */
export function RejectDialog({ kind, entry, onClose }) {
  return (
    <ReasonDecisionDialog
      kind={kind}
      entry={entry}
      decision="reject"
      title={`Reject ${entryKinds[kind].noun}`}
      intro="The submitter can correct it and send it back for approval."
      submitLabel="Reject"
      onClose={onClose}
    />
  );
}
