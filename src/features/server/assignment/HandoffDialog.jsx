import React, { useId, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { AssigneeSelect } from './AssigneeSelect.jsx';
import { AssignmentNoteField } from './AssignmentNoteField.jsx';
import { noteError } from './assignmentModel.js';

const submitLabel = (returnOnly, warn) =>
  returnOnly ? "Return to client's holder" : warn ? 'Hand off record' : 'Reassign';

/**
 * Reassign one record, warning assigned-only callers before they lose sight of it. A return-only
 * caller (assignmentModel `returnsOnly`) gets no picker: the follow-up goes back to the client's
 * holder.
 */
export function HandoffDialog({ module, recordLabel, assignment, assignees, onClose }) {
  const titleId = useId();
  const fieldId = useId();
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const { busy, entry, me, returnOnly } = assignment;
  const toId = returnOnly || choice === 'queue' ? null : choice;
  const chosen = returnOnly || choice !== '';
  const unchanged = choice !== '' && toId === (entry?.assignee ?? null);
  const warn = choice !== '' && !unchanged && assignment.willLose(toId);
  const issue = noteError(note);
  const blocked = busy || !chosen || unchanged || Boolean(issue);
  const close = () => {
    if (!busy) onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (blocked) return;
    setMessage('');
    const result = await assignment.assign(toId, note);
    if (result?.message) setMessage(result.message);
    else if (result?.done) onClose();
  };
  return (
    <Drawer className="assignment-dialog" titleId={titleId} onClose={close}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">{module.toUpperCase()} · ASSIGNMENT</div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {returnOnly ? 'Return' : 'Reassign'} {recordLabel}
          </h2>
          <p>
            {returnOnly
              ? "The client's holder will get this follow-up back, and it will leave your list."
              : 'Choose an active team member with access to this record type.'}
          </p>
        </div>
        <button
          className="icon-btn"
          aria-label="Close reassignment"
          disabled={busy}
          onClick={close}
        >
          <Icon name="close" size={21} />
        </button>
      </div>
      <form className="drawer-form" onSubmit={submit} noValidate>
        <div className="drawer-body assignment-dialog-body">
          {!returnOnly && (
            <AssigneeSelect
              id={fieldId}
              module={module}
              assignees={assignees}
              value={choice}
              onChange={(value) => {
                setChoice(value);
                setMessage('');
              }}
              allowQueue={assignment.canQueue}
              current={entry?.assignee}
              me={me}
            />
          )}
          {unchanged && <p className="assignment-hint">This is already the current assignee.</p>}
          {warn && (
            <div className="assignment-warning" role="alert">
              <Icon name="info" size={18} />
              <p>
                <strong>You will no longer see this record.</strong> Only the new assignee, your
                Admin and full-team members will have access after the hand-off.
              </p>
            </div>
          )}
          <AssignmentNoteField
            id={`${fieldId}-note`}
            value={note}
            onChange={setNote}
            disabled={busy}
          />
          {issue && <p className="field-error">{issue}</p>}
          {message && (
            <p className="field-error" role="alert">
              {message}
            </p>
          )}
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={blocked}>
            {busy ? 'Saving…' : submitLabel(returnOnly, warn)}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
