import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { workspaceOpenLabel, workspaceStatusLabel } from './workspacePickerModel.js';

function WorkspaceGroup({ label, workspaces, owner, busy, onSelect }) {
  if (!workspaces.length) return null;
  return (
    <section className="workspace-picker-group" aria-label={label}>
      <h3>
        {label} <span>{workspaces.length}</span>
      </h3>
      <ul className="workspace-picker-options">
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            <button
              type="button"
              className="workspace-picker-option"
              aria-label={workspaceOpenLabel(workspace)}
              aria-pressed={workspace.id === owner.id}
              disabled={busy}
              onClick={() => onSelect(workspace.id)}
            >
              <span>
                <strong>{workspace.name}</strong>
                <small>{workspaceStatusLabel(workspace)}</small>
              </span>
              {workspace.id === owner.id && (
                <span className="workspace-picker-selected">
                  Selected <Icon name="check" size={16} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WorkspacePickerResults({ workspaces, ...props }) {
  return (
    <>
      <WorkspaceGroup
        {...props}
        label="Current workspaces"
        workspaces={workspaces.filter((workspace) => workspace.status !== 'archived')}
      />
      <WorkspaceGroup
        {...props}
        label="Archived workspaces · Read-only"
        workspaces={workspaces.filter((workspace) => workspace.status === 'archived')}
      />
    </>
  );
}
