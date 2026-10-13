import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { schema } from '../../../lib/schema.js';
import { useAssignment } from './useAssignment.js';
import { useAssignees } from './useAssignees.js';
import { assigneeLabel, personName, queueCollections } from './assignmentModel.js';
import { HandoffDialog } from './HandoffDialog.jsx';
import { AssignmentHistory } from './AssignmentHistory.jsx';

/** Current holder in record details, with Reassign (or Return, for a return-only follow-up). */
export function AssigneeField({ module, record }) {
  const headingId = useId();
  const assignment = useAssignment(module, record);
  // GET assignees needs Hand on or team scope (contract §12 L-5); others see generic names.
  const listed = assignment.canAssign || assignment.scope === 'team';
  const assignees = useAssignees(module, Boolean(assignment.entry) && listed);
  const [open, setOpen] = useState(false);
  const { entry, holder, me } = assignment;
  if (!entry) return null;
  const queued = !entry.assignee && queueCollections.includes(module);
  const inheritedFrom = module === 'Follow-ups' && !entry.assignee && holder;
  return (
    <section className="assignment-panel" aria-labelledby={headingId}>
      <div className="assignment-row">
        <span className="assignment-icon" aria-hidden="true">
          <Icon name="person" size={18} />
        </span>
        <div className="assignment-current">
          <h3 id={headingId}>Assigned to</h3>
          <strong className={queued ? 'assignment-queue' : undefined}>
            {assigneeLabel(module, entry.assignee, assignees.people, me)}
          </strong>
          {inheritedFrom && (
            <small>Follows the client's assignee: {personName(assignees.people, holder, me)}</small>
          )}
        </div>
        {assignment.canReassign && (
          <Button variant="light" icon="users" onClick={() => setOpen(true)}>
            {assignment.returnOnly ? 'Return to holder' : 'Reassign'}
          </Button>
        )}
      </div>
      <AssignmentHistory module={module} entry={entry} />
      {open && (
        <HandoffDialog
          module={module}
          recordLabel={record[schema(module)[0].key]}
          assignment={assignment}
          assignees={assignees}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
