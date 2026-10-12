import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useSession } from '../../hooks/useSession.js';
import { hasMessagingAccess } from '../messaging/model.js';

export function RecordRowActions({ module, record, id, readOnly }) {
  const { startMessage } = useWorkspaceActions();
  const { user } = useSession();
  return (
    <>
      {module === 'Clients' && !readOnly && (
        <button
          type="button"
          className="row-link message-row-action"
          aria-label={`Start message with ${record.full_name || record.client_id}`}
          title="Start message"
          disabled={!hasMessagingAccess(user)}
          onClick={(event) => {
            event.stopPropagation();
            startMessage(record);
          }}
        >
          <Icon name="chat" size={17} />
        </button>
      )}
      <button className="row-link" aria-label={`Open record ${id}`} title="Open record">
        <Icon name="arrow" size={17} />
      </button>
    </>
  );
}
