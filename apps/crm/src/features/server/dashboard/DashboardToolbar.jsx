import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useRecordAccess } from '../../records/useRecordAccess.js';
import { hasTeamFeatures } from '../access.js';
import { AssignedToFilter } from '../assignment/AssignedToFilter.jsx';
import './dashboard-toolbar.css';

/**
 * The Dashboard's toolbar row (Bitrix24's structure, approved mockup): the quick actions, what
 * the figures cover and, for teams, whose workload they show. The top bar names the page, so
 * there is no welcome block or second heading above the figures.
 */
export function DashboardToolbar({ workload, caption }) {
  const { user } = useSession();
  const { navigate } = useNavigation();
  const { add } = useWorkspaceActions();
  const can = useRecordAccess();
  return (
    <section className="dashboard-toolbar" aria-label="Workspace quick actions">
      {user.permissions.relationships && can('Clients', 'create') && (
        <Button icon="plus" onClick={() => add('Clients')}>
          Add new lead
        </Button>
      )}
      {user.permissions.schedule && (
        <Button variant="light" icon="clock" onClick={() => navigate('Follow-ups')}>
          View follow-ups
        </Button>
      )}
      <p className="dashboard-scope">{caption}</p>
      {workload.module && hasTeamFeatures(user) && (
        <div className="dashboard-workload">
          <AssignedToFilter
            module={workload.module}
            filter={workload.filter}
            onChange={workload.setFilter}
            assignees={workload.assignees}
            me={workload.me}
            count={workload.count}
          />
        </div>
      )}
    </section>
  );
}
