import React, { useContext } from 'react';
import { RecordsContext } from '../../app/WorkspaceContext.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { hasMessagingAccess } from '../messaging/model.js';

export function RecordRowActions({ module, record, id, readOnly, onOpen }) {
  const { startMessage } = useWorkspaceActions();
  const { user } = useSession();
  // A handed-over client the caller only keeps is not theirs to message (agreements §18).
  const kept = Boolean(useContext(RecordsContext)?.keptFor?.('Clients', record));
  return (
    <>
      {module === 'Clients' && !readOnly && !kept && (
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
      <button
        className="row-link"
        aria-label={`Open record ${id}`}
        title="Open record"
        onClick={
          onOpen &&
          ((event) => {
            event.stopPropagation();
            onOpen();
          })
        }
      >
        <Icon name="arrow" size={17} />
      </button>
    </>
  );
}
