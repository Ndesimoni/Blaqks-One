import React from 'react';
import { useRecords, useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { RecordEditor } from '../records/RecordEditor.jsx';
import { RecordDetails } from '../records/RecordDetails.jsx';

export function ServerDialogs() {
  const { data } = useRecords();
  const { drawer, setDrawer, detail, setDetail } = useWorkspaceView();
  const { saveRecord, deleteRecord, reloadRecord, edit, busy, readOnly } = useWorkspaceActions();
  return (
    <>
      {detail && (
        <RecordDetails
          detail={detail}
          data={data}
          edit={edit}
          remove={deleteRecord}
          close={() => {
            if (!busy) setDetail(null);
          }}
          busy={busy}
          showMessaging={false}
          readOnly={readOnly}
        />
      )}
      {drawer && !readOnly && (
        <RecordEditor
          key={`${drawer.module}:${drawer.revision || 0}`}
          drawer={drawer}
          data={data}
          onClose={() => setDrawer(null)}
          onSave={saveRecord}
          onReload={reloadRecord}
          storageMode="server"
        />
      )}
    </>
  );
}
