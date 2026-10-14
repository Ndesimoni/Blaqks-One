import React, { useMemo } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { DashboardWelcome } from '../../dashboard/DashboardWelcome.jsx';
import { PrioritiesPanel } from '../../dashboard/PrioritiesPanel.jsx';
import { UpcomingViewings } from '../../dashboard/UpcomingViewings.jsx';
import { BarListPanel } from '../../dashboard/BarListPanel.jsx';
import { AssignedToFilter } from '../assignment/AssignedToFilter.jsx';
import { ConnectedMetrics } from './ConnectedMetrics.jsx';
import { RecordCountsPanel } from './RecordCountsPanel.jsx';
import { useDashboardWorkload } from './useDashboardWorkload.js';
import { dashboardWidgets, linkedName, selectConnectedDashboard } from './dashboardModel.js';
import '../assignment/assigned-filter.css';

/** Connected Dashboard: figures from this session's scoped records only, never demo data. */
export function ServerDashboard() {
  const { user } = useSession();
  // Names use every record the viewer can see; only the figures follow the workload filter.
  const { data: visible, scope, referenceFor } = useRecords();
  const workload = useDashboardWorkload();
  const { data } = workload;
  const widgets = dashboardWidgets(user);
  const figures = useMemo(() => selectConnectedDashboard(data), [data]);
  const clientName = (id) => linkedName(visible, referenceFor, 'Clients', id);
  const propertyName = (id) => linkedName(visible, referenceFor, 'Properties', id);
  const caption =
    scope === 'team'
      ? workload.filter
        ? 'Figures for the selected workload'
        : 'Figures from your whole team’s records'
      : 'Figures from the records assigned to you';
  return (
    <div className="page-stack dashboard-page connected-dashboard">
      <DashboardWelcome />
      <div className="subhead-row">
        <div>
          <h2>Your business, at a glance</h2>
          <p>{caption}</p>
        </div>
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
      </div>
      <ConnectedMetrics figures={figures} widgets={widgets} />
      <div className="split-main">
        <RecordCountsPanel
          collections={widgets.collections}
          counts={figures.counts}
          caption="Open a list to review or update these records"
        />
        {widgets.schedule && (
          <PrioritiesPanel
            data={data}
            summary={{ tasks: figures.tasks, dueTasks: figures.dueTasks }}
            clientName={clientName}
          />
        )}
      </div>
      <div className="triple-grid">
        {widgets.leads && (
          <>
            <BarListPanel
              heading="Lead pipeline"
              caption="Where your clients stand today"
              rows={figures.stages}
              max={figures.maxStage}
              empty="No lead stages recorded."
              link={{ label: 'Manage leads', route: 'Leads' }}
            />
            <BarListPanel
              heading="Where leads come from"
              caption="Top channels bringing clients in"
              rows={figures.sources.slice(0, 5)}
              max={figures.maxSource}
              colorOffset={1}
              empty="No lead sources recorded."
              link={{ label: 'Review sources', route: 'Leads' }}
            />
          </>
        )}
        {widgets.schedule && (
          <UpcomingViewings
            data={data}
            summary={{ upcoming: figures.upcoming }}
            clientName={clientName}
            propertyName={propertyName}
          />
        )}
      </div>
    </div>
  );
}
