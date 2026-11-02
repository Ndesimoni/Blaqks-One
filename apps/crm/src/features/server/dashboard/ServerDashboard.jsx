import React, { useMemo } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { useFinance } from '../finance/useFinance.js';
import { ConnectedUpcomingViewings } from './ConnectedUpcomingViewings.jsx';
import { DashboardToolbar } from './DashboardToolbar.jsx';
import { FinanceWidgets } from './FinanceWidgets.jsx';
import { GetStartedChecklist } from './GetStartedChecklist.jsx';
import { KpiTiles } from './KpiTiles.jsx';
import { LeadBars } from './LeadBars.jsx';
import { RecordCountsPanel } from './RecordCountsPanel.jsx';
import { TodayAgenda } from './TodayAgenda.jsx';
import { dashboardWidgets, linkedName, selectConnectedDashboard } from './dashboardModel.js';
import { workloadDeals } from './kpiModel.js';
import { showsListingViewings, upcomingEntries } from './upcomingModel.js';
import { useDashboardWorkload } from './useDashboardWorkload.js';
import '../assignment/assigned-filter.css';
import './chart-tokens.css';
import './dashboard-charts.css';

/**
 * Connected Dashboard as the approved mockup's screen (design queue item 8): the four figure
 * tiles and Today first, then the panels the owner kept (Get started for the Admin, finance,
 * the lead charts, upcoming viewings and records in view). Figures come from this session's
 * scoped records and the workspace's scoped finance overview only, never demo data.
 */
export function ServerDashboard({ owner }) {
  const { api, user, company } = useSession();
  // Names use every record the viewer can see; only the figures follow the workload filter.
  const { data: visible, scope, referenceFor, listingViewings } = useRecords();
  const workload = useDashboardWorkload();
  const { data } = workload;
  const widgets = dashboardWidgets(user);
  // One finance request feeds the pipeline tile and the finance panel, only where they show.
  const finance = useFinance(api, owner?.id, widgets.finance && owner ? user : null);
  const figures = useMemo(() => selectConnectedDashboard(data), [data]);
  const ownView = showsListingViewings(workload.filter, workload.me);
  const upcoming = useMemo(
    () => upcomingEntries(figures.upcoming, listingViewings, ownView),
    [figures.upcoming, listingViewings, ownView],
  );
  const deals = finance.overview ? workloadDeals(finance.overview.deals, workload.filter) : null;
  const clientName = (id) => linkedName(visible, referenceFor, 'Clients', id);
  const propertyName = (id) => linkedName(visible, referenceFor, 'Properties', id);
  const today = dubaiToday();
  const caption =
    scope === 'team'
      ? workload.filter
        ? 'Figures for the selected workload'
        : 'Figures from your whole team’s records'
      : 'Figures from the records assigned to you';
  return (
    <div className="page-stack dashboard-page connected-dashboard">
      <DashboardToolbar workload={workload} caption={caption} />
      <KpiTiles data={data} figures={figures} deals={deals} widgets={widgets} today={today} />
      {widgets.schedule && (
        <TodayAgenda
          data={data}
          today={today}
          clientName={clientName}
          propertyName={propertyName}
        />
      )}
      {user.roleId === 'admin' && (
        <GetStartedChecklist
          workspaceId={owner.id}
          data={visible}
          company={company}
          firstName={user.name.trim().split(/\s+/)[0]}
        />
      )}
      {widgets.finance && owner && <FinanceWidgets finance={finance} />}
      <div className="dashboard-charts">
        {widgets.leads && (
          <>
            <LeadBars
              heading="Lead pipeline"
              caption="Where your clients stand today"
              rows={figures.stages}
              empty="No lead stages recorded."
              link={{ label: 'Manage leads', route: 'Leads' }}
            />
            <LeadBars
              heading="Where leads come from"
              caption="Top channels bringing clients in"
              rows={figures.sources.slice(0, 5)}
              empty="No lead sources recorded."
              link={{ label: 'Review sources', route: 'Leads' }}
            />
          </>
        )}
        {widgets.schedule && (
          <ConnectedUpcomingViewings
            entries={upcoming}
            clientName={clientName}
            propertyName={propertyName}
          />
        )}
      </div>
      <RecordCountsPanel
        collections={widgets.collections}
        counts={figures.counts}
        caption="Open a list to review or update these records"
      />
    </div>
  );
}
