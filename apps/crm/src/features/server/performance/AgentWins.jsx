import React, { useId } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { compactAed } from '../dashboard/kpiModel.js';
import { longMonth } from './chartModel.js';
import { agentWins } from './performanceKpis.js';
import './agent-wins.css';

/**
 * The approved mockup's "Deals won by agent" card for the whole team: one bar per agent on one
 * scale (deals won), with the count and the gross fees earned written beside it, so the
 * bars are never read alone. Shown only with team finance for the whole team.
 */
export function AgentWins({ closed, month }) {
  const { t } = useI18n();
  const headingId = useId();
  const rows = agentWins(closed);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const name = longMonth(month).split(' ')[0];
  return (
    <section className="panel agent-wins" aria-labelledby={headingId}>
      <h2 id={headingId} className="agent-wins-title">
        {t('performance.winsTitle', { month: name })}
      </h2>
      {rows.length ? (
        <ul className="agent-wins-list">
          {rows.map((row) => (
            <li key={row.id ?? 'queue'} className="agent-win">
              <span className="agent-win-name">{row.name || t('performance.queue')}</span>
              <span className="agent-win-track" aria-hidden="true">
                <span style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
              <span className="agent-win-value">
                {t('performance.winsValue', { count: row.count, fees: compactAed(row.fils) })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="agent-wins-empty">{t('performance.winsNone', { month: longMonth(month) })}</p>
      )}
    </section>
  );
}
