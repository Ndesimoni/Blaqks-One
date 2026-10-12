import React from 'react';
import { useRecords, useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { RecordEditor } from '../records/RecordEditor.jsx';
import { RecordDetails } from '../records/RecordDetails.jsx';
import { serverIdPolicy } from './access.js';
import { AssignmentDetails } from './assignment/AssignmentDetails.jsx';

export function ServerDialogs() {
  const { data, scope } = useRecords();
  const { drawer, setDrawer, detail, setDetail } = useWorkspaceView();
  const { saveRecord, deleteRecord, reloadRecord, edit, busy, readOnly, canDelete } =
    useWorkspaceActions();
  return (
    <>
      {detail && (
        <RecordDetails
          detail={detail}
          data={data}
          edit={edit}
          remove={deleteRecord}
          canDelete={canDelete(detail.module)}
          extras={<AssignmentDetails module={detail.module} record={detail.record} />}
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
          idPolicy={serverIdPolicy(scope, drawer.original)}
        />
      )}
    </>
  );
}
