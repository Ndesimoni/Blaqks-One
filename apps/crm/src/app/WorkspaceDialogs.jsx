import React from 'react';
import { RecordDetails } from '../features/records/RecordDetails.jsx';
import { RecordEditor } from '../features/records/RecordEditor.jsx';
import { MessageComposerDialog } from '../features/messaging/MessageComposerDialog.jsx';
import { useRecords, useWorkspaceView, useWorkspaceActions } from '../hooks/useWorkspace.js';

export function WorkspaceDialogs() {
  const { data } = useRecords();
  const { detail, setDetail, drawer, setDrawer, messageDraft, setMessageDraft } =
    useWorkspaceView();
  const {
    restoreRef,
    restoreFullBackup,
    uploadRef,
    onUpload,
    edit,
    deleteRecord,
    saveRecord,
    notify,
  } = useWorkspaceActions();
  return (
    <>
      <input
        ref={restoreRef}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        onChange={restoreFullBackup}
      />
      <input
        ref={uploadRef}
        className="sr-only"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onUpload}
      />
      {detail && (
        <RecordDetails
          detail={detail}
          data={data}
          edit={edit}
          remove={deleteRecord}
          close={() => setDetail(null)}
        />
      )}
      {drawer && (
        <RecordEditor
          drawer={drawer}
          data={data}
          onClose={() => setDrawer(null)}
          onSave={saveRecord}
        />
      )}
      {messageDraft && (
        <MessageComposerDialog
          client={messageDraft.client}
          channel={messageDraft.channel}
          onClose={() => setMessageDraft(null)}
          onComplete={() => {
            setMessageDraft(null);
            notify('Message preview closed. No messages were sent.');
          }}
        />
      )}
    </>
  );
}
