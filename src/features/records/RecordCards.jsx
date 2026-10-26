import React from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatValue } from '../../lib/crm.js';
import { clName, get, prName } from '../../lib/records.js';
import { KeptChip } from './KeptChip.jsx';
import { RecordRowActions } from './RecordRowActions.jsx';
import './cards.css';
import { recordCardFields, workflowColumns } from './workflowPresentation.js';

/**
 * Phone presentation of a record page: one card per record, identity and stage first, then the
 * two most scannable facts (all linked/date task context for workflows), then row actions.
 */
export function RecordCards({ module, data, current, pick, readOnly, onOpen }) {
  const {
    id: idColumn,
    title: titleColumn,
    state: stageColumn,
    limit,
  } = recordCardFields(module, pick);
  const factColumns = pick.filter((f) => f !== idColumn && f !== titleColumn && f !== stageColumn);
  const value = (record, field) => {
    const formatted = formatValue(data, module, record, field);
    if (!workflowColumns[module] || formatted === '—') return formatted;
    const name =
      field.name === 'Client ID'
        ? clName(data, get(record, field.name))
        : /^Property ID/.test(field.name)
          ? prName(data, get(record, field.name))
          : '';
    return name && name !== formatted && name !== '—' ? `${name} · ${formatted}` : formatted;
  };
  const filled = (record, field) => value(record, field) !== '—';
  return (
    <ul className="record-cards" aria-label={`${module} records`}>
      {current.map((record, index) => {
        const id = get(record, idColumn.name);
        const facts = factColumns.filter((f) => filled(record, f)).slice(0, limit);
        const stage = stageColumn && filled(record, stageColumn) ? value(record, stageColumn) : '';
        return (
          <li key={id || index} className="record-card">
            <div className="record-card-head">
              <div className="record-card-identity">
                <span className="record-card-title">{value(record, titleColumn)}</span>
                <span className="record-card-id mono">{value(record, idColumn)}</span>
              </div>
              {stage && <Badge>{stage}</Badge>}
            </div>
            {facts.length > 0 && (
              <dl className="record-card-facts">
                {facts.map((field) => (
                  <div key={field.key}>
                    <dt>{field.name.replace(/ AED$/, '')}</dt>
                    <dd>{value(record, field)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="record-card-foot">
              <KeptChip module={module} record={record} />
              <RecordRowActions
                module={module}
                record={record}
                id={id}
                readOnly={readOnly}
                onOpen={() => onOpen?.(record)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
