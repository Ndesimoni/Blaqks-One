import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { GoalRow } from './GoalRow.jsx';

function caption(selection, editable, hidden) {
  if (selection.kind === 'queue') return 'Unassigned records have no targets';
  if (hidden) return 'Member targets are visible only to that member and your Admin';
  if (editable)
    return selection.kind === 'team'
      ? 'Team targets · automatic actuals'
      : 'Member targets · automatic actuals';
  return 'Targets set by your Admin · automatic actuals';
}

/**
 * Monthly goals for the selection. Only the workspace's Admin edits targets; everyone else
 * reads them. Finance measures show a placeholder while finance loads or after a failure.
 */
export function PerformanceGoals({
  metrics,
  current,
  targets,
  selection,
  finance,
  hidden,
  onSave,
}) {
  const editable = targets.canEdit && selection.kind !== 'queue';
  const pending = finance.loading
    ? 'Loading finance…'
    : finance.error
      ? 'Finance could not be loaded.'
      : '';
  return (
    <section className="panel connected-goals" aria-label="Monthly goals">
      <TitleSection heading="Monthly goals" caption={caption(selection, editable, hidden)} />
      {targets.loading && <p role="status">Loading targets…</p>}
      {targets.error && (
        <div className="goal-error">
          <p className="field-error" role="alert">
            {targets.error}
          </p>
          <Button variant="light" onClick={targets.retry}>
            Retry
          </Button>
        </div>
      )}
      <div className="goals">
        {metrics.map((metric) => (
          <GoalRow
            key={metric.key}
            metric={metric}
            actual={current[metric.key] ?? 0}
            target={hidden ? undefined : targets.forSelection[metric.key]}
            hidden={hidden}
            pending={metric.finance ? pending : ''}
            editable={editable && !targets.loading && !targets.error}
            onSave={(input) => onSave({ ...input, memberId: selection.memberId })}
          />
        ))}
      </div>
      {finance.error && (
        <Button variant="light" onClick={finance.retry}>
          Retry finance
        </Button>
      )}
    </section>
  );
}
