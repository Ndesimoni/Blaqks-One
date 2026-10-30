import React from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { isViewOnly } from './access.js';

/** Page-heading chip for members who may neither add nor edit this module's records. */
export function ViewOnlyChip({ module }) {
  const { user } = useSession();
  const { readOnly = false } = useWorkspaceActions();
  // Archived workspaces already explain that every record is read-only.
  if (readOnly || !isViewOnly(user, module)) return null;
  return (
    <span className="demo-pill view-only-chip">
      <span /> View only
      <span className="sr-only">: you can review these records but not add or change them.</span>
    </span>
  );
}
