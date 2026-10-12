import React, { useId, useMemo, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { AssigneeSelect } from './AssigneeSelect.jsx';
import { AssignmentNoteField } from './AssignmentNoteField.jsx';
import { useBulkReassign } from './useBulkReassign.js';
import { assignedToLabel, bulkLimit, bulkTargets, noteError } from './assignmentModel.js';

/** Team scope: move every record in the current "Assigned to" filter together, or none. */
export function BulkReassignDialog({ module, filter, assignees, me, onClose }) {
  const titleId = useId();
  const fieldId = useId();
  const { entries } = useRecords();
  const { records: targets, tooMany } = useMemo(
    () => bulkTargets(entries, module, filter),
    [entries, module, filter],
  );
  const bulk = useBulkReassign(module, targets);
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const issue = noteError(note);
  const same = choice !== '' && choice === filter;
  const blocked = bulk.busy || !choice || same || !targets.length || tooMany || Boolean(issue);
  const close = () => {
    if (!bulk.busy) onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (blocked) return;
    setMessage('');
    const result = await bulk.submit(choice === 'queue' ? null : choice, note);
    if (result?.message) setMessage(result.message);
    else if (result?.done) onClose();
  };
  const source = assignedToLabel(filter, assignees.people, me);
  return (
    <Drawer className="assignment-dialog" titleId={titleId} onClose={close}>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">{module.toUpperCase()} · BULK REASSIGNMENT</div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            Reassign {targets.length} {targets.length === 1 ? 'record' : 'records'}
          </h2>
          <p>Currently assigned to {source}.</p>
        </div>
        <button
          className="icon-btn"
          aria-label="Close bulk reassignment"
          disabled={bulk.busy}
          onClick={close}
        >
          <Icon name="close" size={21} />
        </button>
      </div>
      <form className="drawer-form" onSubmit={submit} noValidate>
        <div className="drawer-body assignment-dialog-body">
          <p className="assignment-hint">
            All listed records move together. If any record has changed or is no longer available,
            nothing is changed and the list is refreshed.
          </p>
          {tooMany && (
            <p className="field-error" role="alert">
              This filter has more than {bulkLimit} records. Reassign at most {bulkLimit} at a time.
            </p>
          )}
          <AssigneeSelect
            id={fieldId}
            module={module}
            assignees={assignees}
            value={choice}
            onChange={(value) => {
              setChoice(value);
              setMessage('');
            }}
            allowQueue
            me={me}
          />
          {same && <p className="assignment-hint">These records are already assigned there.</p>}
          <AssignmentNoteField
            id={`${fieldId}-note`}
            value={note}
            onChange={setNote}
            disabled={bulk.busy}
          />
          {issue && <p className="field-error">{issue}</p>}
          {message && (
            <div className="assignment-warning assignment-error" role="alert">
              <Icon name="info" size={18} />
              <p>{message}</p>
            </div>
          )}
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={bulk.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={blocked}>
            {bulk.busy ? 'Reassigning…' : `Reassign ${targets.length}`}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
