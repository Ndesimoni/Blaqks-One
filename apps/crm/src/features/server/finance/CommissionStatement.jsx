import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { readableDate } from '../../../lib/dates.js';
import { formatAed, formatPercent } from '../../../lib/finance/money.js';
import { useAgentStatement, useFinanceContext } from './useFinanceRequests.js';

const roleLabels = { primary: 'Deal holder', second: 'Second agent' };

/** Statement totals and lines; lines never link to deals the reader may not see (§5.2). */
function StatementBody({ statement, owner }) {
  const { totals, lines } = statement;
  return (
    <>
      <dl className="finance-totals" aria-label={`${owner} totals`}>
        {[
          ['Commission earned', totals.earnedFils],
          ['Received share', totals.receivedShareFils],
          ['Outstanding', totals.outstandingFils],
        ].map(([label, value]) => (
          <div key={label} className="finance-total">
            <dt>{label}</dt>
            <dd className="finance-money">{formatAed(value)}</dd>
          </div>
        ))}
      </dl>
      {!lines.length ? (
        <Empty icon="wallet" title="No earned commission yet" detail="Earned deals appear here." />
      ) : (
        <div className="table-shell">
          <div className="table-scroll">
            <table className="data-table finance-statement" aria-label={`${owner} lines`}>
              <thead>
                <tr>
                  <th scope="col">Deal</th>
                  <th scope="col">Earned</th>
                  <th scope="col">Role</th>
                  <th scope="col" className="finance-num">
                    Share
                  </th>
                  <th scope="col" className="finance-num">
                    Commission
                  </th>
                  <th scope="col" className="finance-num">
                    Received
                  </th>
                  <th scope="col" className="finance-num">
                    Outstanding
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={`${line.dealId}:${line.role}`}>
                    <td>
                      <span className="mono">{line.dealId}</span>
                      <small className="finance-sub">{line.dealType}</small>
                    </td>
                    <td>{readableDate(line.earnedOn)}</td>
                    <td>{roleLabels[line.role]}</td>
                    <td className="finance-num">
                      {line.shareBp === null ? '—' : formatPercent(line.shareBp)}
                      {line.adjusted && <small className="finance-sub">Adjusted by Admin</small>}
                    </td>
                    <td className="finance-num finance-money">{formatAed(line.amountFils)}</td>
                    <td className="finance-num finance-money">
                      {formatAed(line.receivedShareFils)}
                    </td>
                    <td className="finance-num finance-money">{formatAed(line.outstandingFils)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Commission statement (finance-design §6.2, §7): the caller's own lines, or for team view a
 * chosen agent's. Received shares count approved receipts only.
 */
export function CommissionStatement() {
  const { api, workspaceId, access, team, overview, assignees, user } = useFinanceContext();
  const id = useId();
  const [agent, setAgent] = useState('');
  const chosen = useAgentStatement(api, workspaceId, access, agent === user.id ? '' : agent);
  const person = assignees.people.find((item) => item.id === agent);
  const owner = person && agent !== user.id ? `${person.name}'s statement` : 'Your statement';
  const statement = agent && agent !== user.id ? chosen.value : overview.statement;
  return (
    <section className="panel finance-statement-panel" aria-labelledby={`${id}-title`}>
      <div className="finance-calc-head">
        <h2 id={`${id}-title`}>{owner}</h2>
        {team && (
          <div className="finance-filter">
            <label htmlFor={`${id}-agent`}>Agent</label>
            <select
              id={`${id}-agent`}
              value={agent}
              onChange={(event) => setAgent(event.target.value)}
            >
              <option value="">Your statement</option>
              {assignees.people
                .filter((item) => item.id !== user.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
      {chosen.loading && (
        <p className="finance-status" role="status">
          Loading statement…
        </p>
      )}
      {chosen.error && (
        <div role="alert" className="finance-alert">
          <p>{chosen.error}</p>
          <Button variant="light" onClick={chosen.retry}>
            Try again
          </Button>
        </div>
      )}
      {statement && <StatementBody statement={statement} owner={owner} />}
    </section>
  );
}
