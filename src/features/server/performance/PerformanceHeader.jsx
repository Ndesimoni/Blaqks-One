import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { AssignedToFilter } from '../assignment/AssignedToFilter.jsx';
import '../assignment/assigned-filter.css';
import { useSession } from '../../../hooks/useSession.js';
import { hasTeamFeatures } from '../access.js';

const validMonth = (value) => /^(20\d\d|2100)-(0[1-9]|1[0-2])$/.test(value);

function context(scope, selection) {
  if (scope !== 'team')
    return ['Your performance', 'Your own figures and the targets your Admin set for you.'];
  if (selection.kind === 'queue')
    return ['Unassigned records', 'Figures for records nobody holds yet.'];
  if (selection.kind === 'member')
    return ['One member', 'Figures and targets for the selected member.'];
  return ['Whole team', 'Figures and targets for your whole team.'];
}

/** Filter bar: who the figures cover, the month picker and, for team scope, Assigned to. */
export function PerformanceHeader({ month, onMonth, selection, scope, workload }) {
  const { user } = useSession();
  const id = useId();
  const [title, detail] = context(scope, selection);
  return (
    <section className="panel perf-toolbar" aria-label="Performance filters">
      <div className="perf-toolbar-context">
        <span className="perf-scope-icon" aria-hidden="true">
          <Icon name={selection.kind === 'team' ? 'users' : 'person'} size={18} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
      </div>
      <div className="perf-toolbar-controls">
        <div className="perf-month">
          <label htmlFor={id}>Month</label>
          <span className="date-select">
            <Icon name="calendar" size={16} />
            <input
              id={id}
              aria-label="Performance month"
              type="month"
              min="2000-01"
              max="2100-12"
              value={month}
              onChange={(event) => validMonth(event.target.value) && onMonth(event.target.value)}
            />
          </span>
        </div>
        {workload.module && hasTeamFeatures(user) && (
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
    </section>
  );
}
