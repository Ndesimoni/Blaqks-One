import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useRecordAccess } from '../records/useRecordAccess.js';

export function DashboardWelcome() {
  const { user } = useSession();
  const { navigate } = useNavigation();
  const { add } = useWorkspaceActions();
  const can = useRecordAccess();
  return (
    <section className="dashboard-welcome" aria-label="Workspace quick actions">
      <div>
        <h2>Keep your next opportunity moving.</h2>
        <p>Review your priorities, follow up with clients and build your portfolio.</p>
      </div>
      <div className="dashboard-quick-actions">
        {user.permissions.schedule && (
          <Button variant="light" icon="clock" onClick={() => navigate('Follow-ups')}>
            View follow-ups
          </Button>
        )}
        {user.permissions.relationships && can('Clients', 'create') && (
          <Button icon="plus" onClick={() => add('Clients')}>
            Add new lead
          </Button>
        )}
      </div>
    </section>
  );
}
