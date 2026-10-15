import React, { useState } from 'react';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { MessagePreviewDialog } from '../../messaging/MessagePreviewDialog.jsx';
import { ClientPicker } from '../../clients/ClientPicker.jsx';
import { ClientMessageTools, ClientProfileHero } from '../../clients/ClientProfile.jsx';
import { ClientMatches, ClientTimeline } from '../../clients/ClientActivity.jsx';
import { selectClientDesk, selectClientTimeline } from '../../clients/selectors.js';
import { canOpenSection } from '../access.js';
import { linkedName } from '../dashboard/dashboardModel.js';
import { TaskClientsPanel } from './TaskClientsPanel.jsx';
import { selectTaskClients } from './clientDeskModel.js';
import './client-desk-layout.css';

/**
 * Connected Client desk over the session's scoped Clients and Properties. Clients reached only
 * through an assigned follow-up appear as contact cards, never as profiles or matches.
 */
export function ServerClientDesk() {
  const { user } = useSession();
  const { data, taskClients, referenceFor } = useRecords();
  const { query, selectedClient } = useWorkspaceView();
  const [channel, setChannel] = useState(null);
  const { clients, client, matches } = selectClientDesk(data, query, selectedClient);
  const timeline = selectClientTimeline(data, client, (id) =>
    linkedName(data, referenceFor, 'Properties', id),
  );
  const contacts = selectTaskClients(taskClients, data.Clients, query);
  return (
    <div className="desk-layout connected-desk">
      <ClientPicker clients={clients} client={client} />
      <div className="desk-body">
        {client ? (
          <>
            <ClientProfileHero client={client} />
            <ClientMessageTools
              client={client}
              onPreview={setChannel}
              caption="Channel access comes from your account permissions. Sender accounts are not connected."
            />
            {canOpenSection(user, 'Properties') && (
              <ClientMatches client={client} matches={matches} />
            )}
            {canOpenSection(user, 'Follow-ups') && <ClientTimeline timeline={timeline} />}
          </>
        ) : (
          <Empty
            title={data.Clients.length ? 'No matching clients' : 'Select a client'}
            detail={
              data.Clients.length
                ? 'Try another name, phone number or ID.'
                : 'Clients you can work with appear here with their property matches.'
            }
            icon="users"
          />
        )}
        <TaskClientsPanel clients={contacts} />
      </div>
      {channel && client && (
        <MessagePreviewDialog
          channel={channel}
          recipient={{
            name: client.full_name || 'Client',
            phone: client.phone,
            email: client.email,
          }}
          onClose={() => setChannel(null)}
        />
      )}
    </div>
  );
}
