import React from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { LabelValue } from '../../components/ui/LabelValue.jsx';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useSession } from '../../hooks/useSession.js';
import { deriveLeadScore, leadTier } from '../../lib/crm.js';
import { AED } from '../../lib/format.js';
import { get, initials } from '../../lib/records.js';
import { validPhone } from '../team/model.js';
import { hasMessagingAccess, validEmail } from '../messaging/model.js';
import { useRecordAccess } from '../records/useRecordAccess.js';

/** Selected client's profile summary; Edit profile appears only when Clients may be edited. */
export function ClientProfileHero({ client }) {
  const { edit } = useWorkspaceActions();
  const can = useRecordAccess();
  return (
    <section className="panel profile-hero">
      <div className="profile-head">
        <span className="big-avatar">{initials(get(client, 'Full name'))}</span>
        <div>
          <span className="eyebrow">CLIENT PROFILE · {get(client, 'Client ID')}</span>
          <h2>{get(client, 'Full name')}</h2>
          <div className="profile-meta">
            <Badge>{get(client, 'Lead stage')}</Badge>
            <span>
              <Icon name="pin" size={15} />
              {get(client, 'Emirate') || 'UAE'}
            </span>
          </div>
        </div>
        {can('Clients', 'edit') && (
          <button className="btn btn-light" onClick={() => edit('Clients', client)}>
            <Icon name="edit" size={16} /> Edit profile
          </button>
        )}
      </div>
      <div className="profile-stats">
        <LabelValue label="Interested in" value={get(client, 'Buy / rent')} />
        <LabelValue label="Budget up to" value={AED(get(client, 'Maximum budget AED'))} />
        <LabelValue label="Preferred area" value={get(client, 'Preferred communities')} />
        <LabelValue
          label="Lead quality"
          value={`${deriveLeadScore(client)}/100 · ${leadTier(client)}`}
        />
      </div>
    </section>
  );
}

/** Message shortcuts for the selected client; previews never deliver externally. */
export function ClientMessageTools({
  client,
  onPreview,
  caption = 'Channel access is assigned by your Super Admin. Sender accounts are not connected.',
}) {
  const { user } = useSession();
  const { startMessage } = useWorkspaceActions();
  return (
    <section className="panel client-message-tools">
      <TitleSection heading="Contact this client" caption={caption} />
      <div className="team-inline-actions">
        <Button
          icon="chat"
          disabled={!hasMessagingAccess(user)}
          onClick={() => startMessage(client)}
        >
          Start message
        </Button>
        <Button
          variant="light"
          icon="chat"
          disabled={!user.channelAccess.whatsapp || !validPhone(client.phone)}
          onClick={() => onPreview('whatsapp')}
        >
          Preview WhatsApp message
        </Button>
        <Button
          variant="light"
          icon="note"
          disabled={!user.channelAccess.email || !validEmail(client.email)}
          onClick={() => onPreview('email')}
        >
          Preview client email
        </Button>
      </div>
      <p className="team-muted">
        WhatsApp: {user.channelAccess.whatsapp ? 'Allowed' : 'Not allowed'} · Email:{' '}
        {user.channelAccess.email ? 'Allowed' : 'Not allowed'}. Previews do not send messages.
      </p>
    </section>
  );
}
