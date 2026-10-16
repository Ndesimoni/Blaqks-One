import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useRecordAccess } from '../../records/useRecordAccess.js';
import { AssignedToFilter } from '../assignment/AssignedToFilter.jsx';

const dateFormat = new Intl.DateTimeFormat('en-AE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Dubai',
});

/**
 * v2 Dashboard header: today's date in Dubai time, the title, the workspace caption, the
 * team-scope workload filter and the actions this member may use.
 */
export function DashboardHeader({ caption, workload }) {
  const { user } = useSession();
  const { navigate } = useNavigation();
  const { add } = useWorkspaceActions();
  const can = useRecordAccess();
  const canAddLead = user.permissions.relationships && can('Clients', 'create');
  return (
    <section className="dash-header" aria-label="Workspace quick actions">
      <div className="dash-header-text">
        <p className="v2-label">{dateFormat.format(new Date())} · Dubai</p>
        <h2 className="dash-title">Your business, at a glance</h2>
        <p className="v2-caption">{caption}</p>
      </div>
      <div className="dash-header-tools">
        {workload.module && (
          <AssignedToFilter
            module={workload.module}
            filter={workload.filter}
            onChange={workload.setFilter}
            assignees={workload.assignees}
            me={workload.me}
            count={workload.count}
          />
        )}
        <div className="dash-header-actions">
          {user.permissions.schedule && (
            <button type="button" className="v2-btn" onClick={() => navigate('Follow-ups')}>
              View follow-ups
            </button>
          )}
          {canAddLead && (
            <button type="button" className="v2-btn v2-btn-primary" onClick={() => add('Clients')}>
              <Icon name="plus" size={16} />
              Add new lead
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
