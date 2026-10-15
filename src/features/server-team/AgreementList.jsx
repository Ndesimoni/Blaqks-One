import React, { useId } from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { formatPercent } from '../../lib/finance/money.js';
import {
  agreementStatus,
  agreementTimelines,
  periodText,
  statusLabels,
  statusTones,
} from './agreementModel.js';

/**
 * Per-agent agreement timelines (finance-design §7, §13 L-F8). Admins may remove agreements
 * that have not started; `readOnly` (team finance staff) shows the timeline only.
 */
export function AgreementList({ list, today, readOnly, busy, onRemove }) {
  const titleId = useId();
  const groups = agreementTimelines(list.agreements);
  return (
    <section
      className="panel team-finance-panel"
      aria-labelledby={titleId}
      aria-busy={list.loading}
    >
      <div className="team-finance-heading">
        <h3 id={titleId}>Agent agreements</h3>
        <p>
          An agent&apos;s own share replaces the team default from its start date. The agreement in
          force on the date a deal is earned applies.
        </p>
      </div>
      {list.loading && !groups.length && <p role="status">Loading agreements…</p>}
      {list.error && (
        <div className="team-finance-recovery">
          <p className="field-error" role="alert">
            {list.error}
          </p>
          <Button variant="light" onClick={list.reload}>
            Retry
          </Button>
        </div>
      )}
      {!list.loading && !list.error && !groups.length && (
        <p className="team-finance-empty">No agreements yet. Every agent gets the team default.</p>
      )}
      {groups.length > 0 && (
        <ul className="team-agreement-groups">
          {groups.map((group) => (
            <li key={group.agent.id}>
              <h4>{group.agent.name}</h4>
              <ol className="team-agreement-timeline" aria-label={`${group.agent.name} agreements`}>
                {group.agreements.map((agreement) => {
                  const status = agreementStatus(agreement, today);
                  const share = formatPercent(agreement.agentShareBp);
                  return (
                    <li key={agreement.id} data-status={status}>
                      <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>
                      <strong className="team-agreement-share">{share}</strong>
                      <span className="team-agreement-period">{periodText(agreement)}</span>
                      {status === 'future' && !readOnly && (
                        <Button
                          variant="light"
                          disabled={busy}
                          aria-label={`Remove the ${share} agreement for ${group.agent.name} starting ${agreement.effectiveFrom}`}
                          onClick={() => onRemove(agreement, group.agent)}
                        >
                          Remove
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && groups.length > 0 && (
        <p className="team-finance-hint">
          Only future agreements can be removed. Removing one lets the agreement it replaced
          continue until the next one starts.
        </p>
      )}
    </section>
  );
}
