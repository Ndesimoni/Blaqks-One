import React from 'react';
import { Metric } from '../../components/ui/Metric.jsx';
import { AED, N } from '../../lib/format.js';

export function DashboardMetrics({ summary, active, completed, monthlyIncome }) {
  return (
    <div className="metrics-grid">
      <Metric
        name="ACTIVE LEADS"
        icon="users"
        value={N(summary.openLeads.length)}
        sub={`${summary.hot.length} high-priority lead${summary.hot.length === 1 ? '' : 's'}`}
        accent="mint"
      />
      <Metric
        name="OPEN DEALS"
        icon="briefcase"
        value={N(active.length)}
        sub={`${completed.length} completed transactions`}
        accent="sky"
      />
      <Metric
        name="FOLLOW-UPS DUE"
        icon="bell"
        value={N(summary.dueTasks.length)}
        sub="Today & overdue"
        accent="rose"
      />
      <Metric
        name="FEES RECEIVED"
        icon="wallet"
        value={AED(monthlyIncome)}
        sub="Selected reporting month"
        accent="sand"
      />
    </div>
  );
}
