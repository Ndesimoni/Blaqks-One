import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { WorkspacePickerDialog } from './WorkspacePickerDialog.jsx';
import './workspace-picker.css';

export function ServerWorkspacePicker({ owner, workspaces, busy, onSelect }) {
  const [open, setOpen] = useState(false);
  const select = (id) => {
    if (busy) return;
    setOpen(false);
    onSelect(id);
  };
  return (
    <div className="field connected-workspace-picker">
      <span className="workspace-picker-label">Workspace</span>
      <Button
        variant="light"
        className="workspace-picker-trigger"
        aria-label="Workspace"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        <span>{owner.name}</span>
        <Icon name="down" size={16} />
      </Button>
      {open && (
        <WorkspacePickerDialog
          owner={owner}
          workspaces={workspaces}
          busy={busy}
          onSelect={select}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
