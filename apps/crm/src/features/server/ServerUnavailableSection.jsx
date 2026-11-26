import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { StateView } from '../../components/ui/StateView.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { canOpenSection } from './access.js';
import { sectionDescription } from './sectionStatus.js';

/** A section not connected to saved workspace data yet, in the mockup's state style. */
export function ServerUnavailableSection({ route, owner }) {
  const { user } = useSession();
  const { navigate } = useNavigation();
  const available = ['Clients', 'Properties', 'Team & access'].find((name) =>
    canOpenSection(user, name),
  );
  const notes = [
    'This screen has not been connected to your saved workspace data yet. It cannot create or change records here.',
    route === 'Messages' &&
      'Email and WhatsApp accounts are not connected. No messages can be sent from this screen.',
    `Workspace: ${owner.name}.`,
    owner.status === 'archived' && 'This workspace is archived. Saved records remain read-only.',
  ];
  return (
    <StateView
      icon="info"
      label={`${route} connection status`}
      title={`${route === 'Team & access' ? 'Team' : route} is not connected yet`}
      detail={sectionDescription(route)}
      note={notes.filter(Boolean).join(' ')}
    >
      {available && (
        <Button variant="light" onClick={() => navigate(available)}>
          {available === 'Team & access' ? 'Open Team' : `Open ${available}`}
        </Button>
      )}
    </StateView>
  );
}
