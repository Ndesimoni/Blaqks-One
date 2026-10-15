import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useFinanceContext, useFinanceHistory } from './useFinanceRequests.js';
import { changeLines, historyLabel, historyTime } from './historyModel.js';

/** The loaded timeline: who did what and when, with team-only changes and reasons. */
function HistoryList({ kind, row }) {
  const { api, workspaceId, access } = useFinanceContext();
  const history = useFinanceHistory(api, workspaceId, access, kind, row);
  const team = access.scope === 'team';
  if (history.loading)
    return (
      <p className="finance-status" role="status">
        Loading history…
      </p>
    );
  if (history.error)
    return (
      <div className="finance-alert" role="alert">
        <p>{history.error}</p>
        <Button variant="light" onClick={history.retry}>
          Retry
        </Button>
      </div>
    );
  const items = history.value ?? [];
  if (!items.length) return <p className="finance-hint">No history has been recorded yet.</p>;
  return (
    <ol className="finance-history-list">
      {items.map((item, index) => {
        const changes = team ? changeLines(item.changes) : [];
        return (
          <li key={`${item.at}:${index}`}>
            <div className="finance-history-head">
              <strong>{historyLabel(item.action)}</strong>
              <time dateTime={item.at}>{historyTime(item.at)}</time>
            </div>
            <span className="finance-sub">By {item.actor.name}</span>
            {item.reason && <p className="finance-history-reason">Reason: {item.reason}</p>}
            {changes.length > 0 && (
              <ul className="finance-history-changes">
                {changes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A deal's, payment's or expense's history (finance-design §5.3, §16.7), loaded only when
 * opened. The own view shows the timeline and rejection reasons; team finance also sees each
 * change. Receipt links and free text appear only as "changed".
 */
export function FinanceHistory({ kind, row }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="finance-history" aria-labelledby={`${id}-title`}>
      <div className="finance-calc-head">
        <h3 id={`${id}-title`}>History</h3>
        <Button
          variant="light"
          icon="clock"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Hide history' : 'Show history'}
        </Button>
      </div>
      <div id={`${id}-panel`} hidden={!open}>
        {open && <HistoryList kind={kind} row={row} />}
      </div>
    </section>
  );
}
