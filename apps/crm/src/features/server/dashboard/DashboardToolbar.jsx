import React from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { hasTeamFeatures } from '../access.js';
import { AssignedToFilter } from '../assignment/AssignedToFilter.jsx';
import './dashboard-toolbar.css';

/**
 * The Dashboard's toolbar row (approved mockup): what the figures cover and, for teams, whose
 * workload they show. Records are added from the top bar's Create, so there are no quick
 * add buttons here, and the top bar names the page.
 */
export function DashboardToolbar({ workload, caption }) {
  const { user } = useSession();
  return (
    <section className="dashboard-toolbar" aria-label="Dashboard scope">
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
