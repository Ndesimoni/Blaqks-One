import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { formatValue, leadTier } from '../../lib/crm.js';
import { AED } from '../../lib/format.js';
import { get } from '../../lib/records.js';
import { schema } from '../../lib/schema.js';
import { leadBudget, leadNeed } from './boardModel.js';
import { leadFieldValue } from './selectors.js';
import './leads-board.css';

const nextField = schema('Clients').find((field) => field.name === 'Next follow-up auto');

/**
 * A lead's Kanban card as the mockup's: name, what they want, then budget and agent on one
 * line; our next follow-up, source and tier tags stay below. The whole body opens the lead's
 * details; the board adds the move control beside it.
 */
export function LeadCardBody({ record, data, name, agent = '', onOpen }) {
  const { t } = useI18n();
  const need = leadNeed(record);
  const budget = leadBudget(record);
  const next = nextField ? formatValue(data, 'Clients', record, nextField) : '—';
  const source = leadFieldValue(record, 'Lead source');
  const tier = leadTier(record);
  return (
    <button
      type="button"
      className="lead-card"
      onClick={onOpen}
      aria-label={t('leadsBoard.open', { name })}
    >
      <strong className="lead-card-name">{name}</strong>
      {need && <span className="lead-card-need">{need}</span>}
      {(budget !== null || agent) && (
        <span className="lead-card-meta">
          <span className="lead-card-budget">
            {budget !== null && t('leadsBoard.budget', { amount: AED(budget) })}
          </span>
          {agent && <span className="lead-card-agent">{agent}</span>}
        </span>
      )}
      {next !== '—' && (
        <span className="lead-card-next">{t('leadsBoard.next', { date: next })}</span>
      )}
      <span className="lead-card-tags">
        {source !== 'Not recorded' && <span className="lead-card-tag">{source}</span>}
        {tier === 'Hot' && <span className="lead-card-tag is-hot">{t('leadsBoard.hot')}</span>}
        {String(get(record, 'Priority') || '').toLowerCase() === 'high' && (
          <span className="lead-card-tag is-hot">{t('leadsBoard.priority')}</span>
        )}
      </span>
    </button>
  );
}
