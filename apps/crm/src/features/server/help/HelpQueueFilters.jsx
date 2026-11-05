import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { HELP_STATES } from './helpModel.js';

/** Open, Answered, Solved and All with counts, and Assigned to me (BO1c). */
export function HelpQueueFilters({ filter, counts, onChange }) {
  const { t } = useI18n();
  const k = (key) => t(`help.${key}`);
  const chip = (state, label, count) => (
    <button
      key={state}
      type="button"
      className="help-chip"
      aria-pressed={filter.state === state}
      onClick={() => onChange({ ...filter, state })}
    >
      {label}
      {count !== undefined && <span>{count}</span>}
    </button>
  );
  return (
    <div className="help-filters" role="group" aria-label={k('filters')}>
      {HELP_STATES.map((state) => chip(state, k(`state.${state}`), counts[state] ?? 0))}
      {chip('all', k('all'))}
      <button
        type="button"
        className="help-chip"
        aria-pressed={filter.assigned === 'me'}
        onClick={() => onChange({ ...filter, assigned: filter.assigned === 'me' ? 'all' : 'me' })}
      >
        {k('assignedToMe')}
      </button>
    </div>
  );
}
