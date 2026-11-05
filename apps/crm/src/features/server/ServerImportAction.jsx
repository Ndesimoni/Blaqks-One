import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { ImportDialog } from './ImportDialog.jsx';

/**
 * Import saved records: the company's own Admin brings old browser or backup records into
 * their own company (BO1a); nobody imports into another company.
 */
export function ServerImportAction({ owner }) {
  const { user } = useSession();
  const { retry } = useRecords();
  const { busy } = useWorkspaceActions();
  const { setToast } = useWorkspaceView();
  const [open, setOpen] = useState(false);
  if (user.roleId !== 'admin' || owner.status === 'archived') return null;
  const imported = (result) => {
    setOpen(false);
    const count = Object.values(result.imported || {}).reduce((sum, value) => sum + value, 0);
    const skipped = Object.values(result.skipped || {}).reduce((sum, value) => sum + value, 0);
    retry();
    setToast(`Import complete: ${count} records imported, ${skipped} already saved.`);
  };
  return (
    <>
      <Button variant="light" icon="upload" disabled={busy} onClick={() => setOpen(true)}>
        Import saved records
      </Button>
      {open && <ImportDialog onClose={() => setOpen(false)} onImported={imported} />}
    </>
  );
}
