import React, { useId, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { AssigneeSelect } from './AssigneeSelect.jsx';
import { AssignmentNoteField } from './AssignmentNoteField.jsx';
import { noteError } from './assignmentModel.js';

/** Reassign one record, warning assigned-only callers before they lose sight of it. */
export function HandoffDialog({ module, recordLabel, assignment, assignees, onClose }) {
  const titleId = useId();
  const fieldId = useId();
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const { busy, entry, me } = assignment;
  const toId = choice === 'queue' ? null : choice;
  const unchanged = choice !== '' && toId === (entry?.assignee ?? null);
  const warn = choice !== '' && !unchanged && assignment.willLose(toId);
  const issue = noteError(note);
  const close = () => {
    if (!busy) onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !choice || unchanged || issue) return;
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
            Reassign {recordLabel}
          </h2>
          <p>Choose an active team member with access to this record type.</p>
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
          <Button type="submit" disabled={busy || !choice || unchanged || Boolean(issue)}>
            {busy ? 'Saving…' : warn ? 'Hand off record' : 'Reassign'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
