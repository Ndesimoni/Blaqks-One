import React from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceScope } from '../../hooks/useWorkspaceScope.js';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';

export function WorkspaceBanner() {
  const { user } = useSession();
  const { owner } = useWorkspaceScope();
  const { navigate } = useNavigation();
  return (
    <section className="workspace-banner" aria-label="Current workspace">
      <Icon name="shield" size={22} />
      <div>
        <strong>{owner.name}’s workspace</strong>
        <p>
          {user.managesTeam
            ? 'Super Admin access · Records belong to this workspace.'
            : 'Your private CRM workspace'}
        </p>
      </div>
      {user.managesTeam && (
        <Button variant="light" onClick={() => navigate('Workspaces')}>
          Switch workspace
        </Button>
      )}
    </section>
  );
}
