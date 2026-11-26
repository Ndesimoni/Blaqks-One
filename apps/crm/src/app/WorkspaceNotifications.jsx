import React from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import { useWorkspaceView, useWorkspaceActions } from '../hooks/useWorkspace.js';

export function WorkspaceNotifications() {
  const { toast, setToast } = useWorkspaceView();
  const { fileBusy } = useWorkspaceActions();
  return (
    <>
      {fileBusy && (
        <div className="toast" role="status">
          Reading selected file…
        </div>
      )}
      {!fileBusy && toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </>
  );
}
