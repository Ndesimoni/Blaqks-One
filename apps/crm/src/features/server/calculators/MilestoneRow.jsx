import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** One editable off-plan milestone: label, share and due date. */
export function MilestoneRow({ row, canRemove, percentError, dateError, onChange, onRemove }) {
  const { t } = useI18n();
  const change = (key) => (event) => onChange(row.id, key, event.target.value);
  return (
    <div className="milestone-row">
      <label>
        <span className="sr-only">{t('calculators.milestone')}</span>
        <input
          value={row.label}
          maxLength={80}
          placeholder={t('calculators.milestone')}
          onChange={change('label')}
        />
      </label>
      <label>
        <span className="sr-only">{t('calculators.percent')}</span>
        <input
          inputMode="decimal"
          value={row.percent}
          placeholder="%"
          aria-invalid={Boolean(percentError)}
          onChange={change('percent')}
        />
      </label>
      <label>
        <span className="sr-only">{t('calculators.date')}</span>
        <input
          type="date"
          value={row.date}
          aria-invalid={Boolean(dateError)}
          onChange={change('date')}
        />
      </label>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('calculators.removeMilestone')}
        disabled={!canRemove}
        onClick={() => onRemove(row.id)}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
