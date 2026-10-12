import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { ImportDialog } from './ImportDialog.jsx';

export function ServerImportAction({ owner, workspaces }) {
  const { user } = useSession();
  const { retry } = useRecords();
  const { busy } = useWorkspaceActions();
  const { setToast } = useWorkspaceView();
  const [open, setOpen] = useState(false);
  const go = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (location.state?.importSummary) setToast(location.state.importSummary);
  }, [location.key, setToast]);
  if (user.roleId !== 'super-admin' || owner.status === 'archived') return null;
  const imported = (result) => {
    setOpen(false);
    const count = Object.values(result.imported || {}).reduce((sum, value) => sum + value, 0);
    const skipped = Object.values(result.skipped || {}).reduce((sum, value) => sum + value, 0);
    const summary = `Import complete: ${count} records imported, ${skipped} already saved.`;
    if (result.targetId === owner.id) {
      retry();
      setToast(summary);
    } else
      go(`${location.pathname}?workspace=${encodeURIComponent(result.targetId)}`, {
        state: { importSummary: summary },
      });
  };
  return (
    <>
      <Button variant="light" icon="upload" disabled={busy} onClick={() => setOpen(true)}>
        Import saved records
      </Button>
      {open && (
        <ImportDialog
          workspaces={workspaces.filter((workspace) => workspace.status !== 'archived')}
          onClose={() => setOpen(false)}
          onImported={imported}
        />
      )}
    </>
  );
}
