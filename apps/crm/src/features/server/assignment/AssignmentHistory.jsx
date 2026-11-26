import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useAssignmentHistory } from './useAssignmentHistory.js';
import { historyDate, reasonLabels } from './assignmentResponses.js';

const who = (person) => person?.name || 'Unassigned';

function HistoryItem({ item }) {
  return (
    <div className="assignment-history-item">
      <div>
        <strong>{reasonLabels[item.reason]}</strong>
        <time dateTime={item.at}>{historyDate(item.at)}</time>
      </div>
      <p>
        {who(item.from)} → {who(item.to)}
        {item.actor ? ` · by ${item.actor.name}` : ''}
      </p>
      {item.note && <blockquote>{item.note}</blockquote>}
    </div>
  );
}

/** On-demand history; compact six-item disclosure with More (docs/option-overflow.md). */
export function AssignmentHistory({ module, entry }) {
  const headingId = useId();
  const { history, loading, error, load } = useAssignmentHistory(module, entry);
  return (
    <div className="assignment-history" aria-labelledby={headingId} role="group">
      <div className="assignment-history-heading">
        <h4 id={headingId}>Assignment history</h4>
        {!history && (
          <Button variant="light" disabled={loading} onClick={load}>
            {loading ? 'Loading…' : error ? 'Try again' : 'Show history'}
          </Button>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {history &&
        (history.length ? (
          <OverflowList
            items={history}
            label="Assignment changes"
            listClassName="assignment-history-list"
            renderItem={(item) => <HistoryItem item={item} />}
          />
        ) : (
          <p className="assignment-hint">No assignment changes are recorded yet.</p>
        ))}
    </div>
  );
}
