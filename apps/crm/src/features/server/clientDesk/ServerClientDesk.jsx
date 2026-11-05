import React from 'react';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { get } from '../../../lib/records.js';
import { selectClientDesk } from '../../clients/selectors.js';
import { RecordTimeline } from '../../records/panel/RecordTimeline.jsx';
import '../../records/panel/record-panel-timeline.css';
import { canOpenSection } from '../access.js';
import { DeskClientHero } from './DeskClientHero.jsx';
import { DeskClientList } from './DeskClientList.jsx';
import { DeskMatches } from './DeskMatches.jsx';
import { TaskClientsPanel } from './TaskClientsPanel.jsx';
import { selectTaskClients } from './clientDeskModel.js';
import './desk.css';
import './desk-cards.css';

/**
 * The connected Client desk as the approved mockup's screen (design queue item 7): the client
 * picker, the chosen client with Call, WhatsApp and Email, their property matches, and their
 * activity beside them, all over the session's scoped records. Clients reached only through
 * an assigned follow-up appear as contact cards, never as profiles or matches.
 */
export function ServerClientDesk() {
  const { t } = useI18n();
  const { user } = useSession();
  const { data, taskClients } = useRecords();
  const { query, selectedClient } = useWorkspaceView();
  const { clients, client, matches } = selectClientDesk(data, query, selectedClient);
  const contacts = selectTaskClients(taskClients, data.Clients, query);
  return (
    <div className="client-desk-wrap">
      <div className="client-desk">
        <DeskClientList clients={clients} client={client} />
        <div className="client-desk-main">
          {client ? (
            <>
              <DeskClientHero key={get(client, 'Client ID')} client={client} />
              {canOpenSection(user, 'Properties') && (
                <DeskMatches client={client} matches={matches} />
              )}
            </>
          ) : (
            <Empty
              icon="users"
              title={t(
                data.Clients.length ? 'clientDesk.noMatchingClients' : 'clientDesk.selectTitle',
              )}
              detail={t(data.Clients.length ? 'clientDesk.tryAnother' : 'clientDesk.selectDetail')}
            />
          )}
          <TaskClientsPanel clients={contacts} />
        </div>
        {client && (
          <div className="client-desk-side">
            <RecordTimeline data={data} client={client} />
          </div>
        )}
      </div>
    </div>
  );
}
