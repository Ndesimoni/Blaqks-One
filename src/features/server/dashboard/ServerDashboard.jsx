import React from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useFinance } from '../finance/useFinance.js';
import { DashboardHeader } from './DashboardHeader.jsx';
import { DashboardBento } from './DashboardBento.jsx';
import { useDashboardData } from './useDashboardData.js';
import { dashboardWidgets } from './dashboardModel.js';
import '../../../styles/v2/index.css';
import '../assignment/assigned-filter.css';
import './dashboard-v2.css';
import './dashboard-sections.css';
import './dashboard-agenda.css';

/**
 * Connected Dashboard (design system v2 · Midnight): figures from this session's scoped
 * records only, never demo data. Finance figures come from the workspace's scoped finance
 * overview, requested only when the member may use finance.
 */
export function ServerDashboard({ owner }) {
  const { user } = useSession();
  const widgets = dashboardWidgets(user);
  if (widgets.finance && owner) return <FinanceDashboard owner={owner} widgets={widgets} />;
  return <DashboardBody owner={owner} widgets={widgets} finance={null} />;
}

function FinanceDashboard({ owner, widgets }) {
  const { api, user } = useSession();
  const finance = useFinance(api, owner.id, user);
  return <DashboardBody owner={owner} widgets={widgets} finance={finance} />;
}

function DashboardBody({ owner, widgets, finance }) {
  const dashboard = useDashboardData(owner, finance);
  return (
    <div className="v2 dash-v2">
      <DashboardHeader caption={dashboard.caption} workload={dashboard.workload} />
      <DashboardBento dashboard={dashboard} widgets={widgets} finance={finance} />
    </div>
  );
}
