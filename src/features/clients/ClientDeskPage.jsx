import { selectClientDesk, selectClientTimeline } from './selectors.js';
import React, { useState } from 'react';
import { Empty } from '../../components/ui/Empty.jsx';
import { useRecords, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useSession } from '../../hooks/useSession.js';
import { MessagePreviewDialog } from '../messaging/MessagePreviewDialog.jsx';
import { ClientPicker } from './ClientPicker.jsx';
import { ClientMessageTools, ClientProfileHero } from './ClientProfile.jsx';
import { ClientMatches, ClientTimeline } from './ClientActivity.jsx';

function ClientDeskPage() {
  const { user } = useSession();
  const [messageChannel, setMessageChannel] = useState(null);
  const { data } = useRecords();
  const { query, selectedClient } = useWorkspaceView();

  const { clients, client, matches } = selectClientDesk(data, query, selectedClient);
  const timeline = selectClientTimeline(data, client);

  return (
    <div className="desk-layout">
      <ClientPicker clients={clients} client={client} />
      <div className="desk-body">
        {client ? (
          <>
            <ClientProfileHero client={client} />
            <ClientMessageTools client={client} onPreview={setMessageChannel} />
            {user.permissions.properties && <ClientMatches client={client} matches={matches} />}
            {user.permissions.schedule && <ClientTimeline timeline={timeline} />}
          </>
        ) : (
          <Empty
            title="Select a client"
            detail="Choose a client on the left to see profile details and property matches."
            icon="users"
          />
        )}
      </div>
      {messageChannel && client && (
        <MessagePreviewDialog
          channel={messageChannel}
          recipient={{
            name: client.full_name || 'Client',
            phone: client.phone,
            email: client.email,
          }}
          onClose={() => setMessageChannel(null)}
        />
      )}
    </div>
  );
}

export { ClientDeskPage };
