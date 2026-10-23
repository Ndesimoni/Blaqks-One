import React from 'react';
import { useRecords, useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { RecordEditor } from '../records/RecordEditor.jsx';
import { RecordDetails } from '../records/RecordDetails.jsx';
import { AssignmentDetails } from './assignment/AssignmentDetails.jsx';
import { KeptNotice } from './KeptNotice.jsx';
import { RecordSharing } from './shares/RecordSharing.jsx';
import { OutsideSharing } from './listingShares/OutsideSharing.jsx';
import { actionCollection, serverIdPolicy } from './access.js';

export function ServerDialogs() {
  const { data, scope, keptFor } = useRecords();
  const { drawer, setDrawer, detail, setDetail } = useWorkspaceView();
  const { saveRecord, deleteRecord, reloadRecord, edit, busy, readOnly, can, canDelete } =
    useWorkspaceActions();
  const kept = detail ? keptFor?.(actionCollection(detail.module), detail.record) : null;
  return (
    <>
      {detail && (
        <RecordDetails
          detail={detail}
          data={data}
          edit={edit}
          remove={deleteRecord}
          canDelete={canDelete(detail.module, detail.record)}
          canEdit={can(detail.module, 'edit') && !kept}
          extras={
            kept ? (
              <KeptNotice badge={kept} />
            ) : (
              <>
                <AssignmentDetails module={detail.module} record={detail.record} />
                <RecordSharing module={detail.module} record={detail.record} />
                <OutsideSharing module={detail.module} record={detail.record} />
              </>
            )
          }
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
