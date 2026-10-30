import React from 'react';
import { selectDashboard } from './selectors.js';
import { DashboardWelcome } from './DashboardWelcome.jsx';
import { DashboardMetrics } from './DashboardMetrics.jsx';
import { CommissionPanel } from './CommissionPanel.jsx';
import { PrioritiesPanel } from './PrioritiesPanel.jsx';
import { PipelinePanels } from './PipelinePanels.jsx';
import { UpcomingViewings } from './UpcomingViewings.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useRecords, useWorkspaceView } from '../../hooks/useWorkspace.js';

export function DashboardPage() {
  const { data, summary } = useRecords();
  const { reportMonth, setReportMonth } = useWorkspaceView();
  const dashboard = selectDashboard(data, summary, reportMonth);
  return (
    <div className="page-stack dashboard-page">
      <DashboardWelcome />
      <div className="subhead-row">
        <div>
          <h2>Your business, at a glance</h2>
          <p>Figures from your workspace records</p>
        </div>
        <label className="date-select">
          <Icon name="calendar" size={16} />
          <input
            aria-label="Reporting month"
            type="month"
            value={reportMonth}
            onChange={(event) => setReportMonth(event.target.value)}
          />
        </label>
      </div>
      <DashboardMetrics summary={summary} {...dashboard} />
      <div className="split-main">
        <CommissionPanel summary={summary} {...dashboard} />
        <PrioritiesPanel data={data} summary={summary} />
      </div>
      <div className="triple-grid">
        <PipelinePanels data={data} {...dashboard} />
        <UpcomingViewings data={data} summary={summary} />
      </div>
    </div>
  );
}
