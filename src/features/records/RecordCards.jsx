import React from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatValue } from '../../lib/crm.js';
import { get } from '../../lib/records.js';
import { KeptChip } from './KeptChip.jsx';
import { RecordRowActions } from './RecordRowActions.jsx';
import './cards.css';

const stageName = /stage|status|tier|priority/i;
const strongName = /Full name|Listing title|Next action|Community/i;

/**
 * Phone presentation of a record page: one card per record, identity and stage first, then the
 * two most scannable facts, then the same row actions the table offers (UI3, B-01).
 */
export function RecordCards({ module, data, current, pick, readOnly, onOpen }) {
  const idColumn = pick[0];
  const titleColumn =
    pick.find((f) => f !== idColumn && strongName.test(f.name)) || pick[1] || idColumn;
  const stageColumn = pick.find((f) => stageName.test(f.name));
  const factColumns = pick.filter((f) => f !== idColumn && f !== titleColumn && f !== stageColumn);
  const value = (record, field) => formatValue(data, module, record, field);
  const filled = (record, field) => value(record, field) !== '—';
  return (
    <ul className="record-cards" aria-label={`${module} records`}>
      {current.map((record, index) => {
        const id = get(record, idColumn.name);
        const facts = factColumns.filter((f) => filled(record, f)).slice(0, 2);
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
