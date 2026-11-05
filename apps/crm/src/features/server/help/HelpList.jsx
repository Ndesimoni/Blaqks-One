import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { STATE_TONES } from './helpModel.js';

/** A list of help requests to choose from; `from` adds who asked (the Blaqks One side). */
export function HelpList({ rows, selected, onSelect, label, from }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`help.${key}`, vars);
  return (
    <ul className="help-list" aria-label={label}>
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            aria-current={row.id === selected ? 'true' : undefined}
            onClick={() => onSelect(row.id)}
          >
            <strong>{row.subject}</strong>
            {from && (
              <span>
                {k('from', {
                  name: row.requesterName || '—',
                  role: row.requesterRole,
                  company: row.company?.name || '—',
                })}
              </span>
            )}
            <span>
              {k(`category.${row.category}`)} · {format.date(row.updatedAt)}
            </span>
            <span className="help-list-chips">
              <Badge tone={STATE_TONES[row.state]}>{k(`state.${row.state}`)}</Badge>
              {!from && row.unread && <Badge tone="green">{k('unread')}</Badge>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
