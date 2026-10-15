import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { AssignedToFilter } from '../assignment/AssignedToFilter.jsx';
import '../assignment/assigned-filter.css';

const validMonth = (value) => /^(20\d\d|2100)-(0[1-9]|1[0-2])$/.test(value);

function context(scope, selection) {
  if (scope !== 'team') return 'Your own figures and the targets your Admin set for you.';
  if (selection.kind === 'queue') return 'Figures for records nobody holds yet.';
  if (selection.kind === 'member') return 'Figures and targets for the selected member.';
  return 'Figures and targets for your whole team.';
}

/** Page heading with the month picker and, for team-scope members, the Assigned-to filter. */
export function PerformanceHeader({ month, onMonth, selection, scope, workload }) {
  return (
    <div className="panel report-head connected-report-head">
      <div>
        <span className="eyebrow">BUSINESS INTELLIGENCE</span>
        <h2>Measure what moves your business.</h2>
        <p>{context(scope, selection)}</p>
      </div>
      <div className="report-controls">
        <label className="date-select">
          <Icon name="calendar" size={16} />
          <input
            aria-label="Performance month"
            type="month"
            min="2000-01"
            max="2100-12"
            value={month}
            onChange={(event) => validMonth(event.target.value) && onMonth(event.target.value)}
          />
        </label>
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
    </div>
  );
}
