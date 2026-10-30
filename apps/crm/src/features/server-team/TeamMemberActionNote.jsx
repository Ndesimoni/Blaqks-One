import React from 'react';
import { moduleLabels } from './model.js';
import { archivedActionText } from './actionText.js';

/** Read-only record-action summary for archived accounts (A2 §3, §12 Info). */
export function TeamMemberActionNote({ member }) {
  return (
    <p className="muted team-action-archived">
      <span className="sr-only">Record actions: </span>
      {archivedActionText(member, moduleLabels)}
    </p>
  );
}
