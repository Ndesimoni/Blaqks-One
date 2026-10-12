import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { canOpenSection } from './access.js';
import { sectionDescription } from './sectionStatus.js';

export function ServerUnavailableSection({ route, owner }) {
  const { user } = useSession();
  const { navigate } = useNavigation();
  const available = ['Clients', 'Properties', 'Team & access'].find((name) =>
    canOpenSection(user, name),
  );
  return (
    <section className="panel recovery-panel" aria-label={`${route} connection status`}>
      <div className="eyebrow">
        <Icon name="info" size={16} /> NOT CONNECTED YET
      </div>
      <h2>{route === 'Team & access' ? 'Team' : route} is not connected yet</h2>
      <p>{sectionDescription(route)}</p>
      <p>
        This screen has not been connected to your saved workspace data yet. It cannot create or
        change records here.
      </p>
      {route === 'Messages' && (
        <p>
          Email and WhatsApp accounts are not connected. No messages can be sent from this screen.
        </p>
      )}
      <p>
        <strong>Workspace:</strong> {owner.name}
      </p>
      {owner.status === 'archived' && (
        <p>This workspace is archived. Saved records remain read-only.</p>
      )}
      {available && (
        <Button variant="light" onClick={() => navigate(available)}>
          {available === 'Team & access' ? 'Open Team' : `Open ${available}`}
        </Button>
      )}
    </section>
  );
}
