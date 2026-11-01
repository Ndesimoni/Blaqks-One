import React from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { clName, get, prName } from '../../lib/records.js';
import { columnHeading } from './grid/columnHeadings.js';
import { cellText } from './grid/gridFields.js';
import { GridPerson, personColumn } from './grid/GridCell.jsx';
import { KeptChip } from './KeptChip.jsx';
import { RecordRowActions } from './RecordRowActions.jsx';
import './cards.css';
import './grid/grid-cards.css';
import { recordCardFields, workflowColumns } from './workflowPresentation.js';

/**
 * Phone presentation of a record page: one card per record, identity and stage first, then the
 * two most scannable facts (all linked/date task context for workflows), then row actions.
 */
export function RecordCards({
  module,
  view = module,
  data,
  current,
  pick,
  identity,
  readOnly,
  onOpen,
}) {
  const {
    id: idColumn,
    title: titleColumn,
    state: stageColumn,
    limit,
  } = recordCardFields(module, pick, identity);
  const factColumns = pick.filter((f) => f !== idColumn && f !== titleColumn && f !== stageColumn);
  const value = (record, field) => {
    const formatted = cellText(data, module, record, field);
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
  const person = personColumn.test(titleColumn?.name || '');
  return (
    <ul className="record-cards" aria-label={`${module} records`}>
      {current.map((record, index) => {
        const id = get(record, idColumn.name);
        const facts = factColumns.filter((f) => filled(record, f)).slice(0, limit);
        const stage = stageColumn && filled(record, stageColumn) ? value(record, stageColumn) : '';
        const title = value(record, titleColumn);
        const identity = (
          <div className="record-card-identity">
            <span className="record-card-title">{title}</span>
            <span className="record-card-id mono">{value(record, idColumn)}</span>
          </div>
        );
        return (
          <li key={id || index} className="record-card">
            <div className="record-card-head">
              {person && title !== '—' ? (
                <GridPerson name={title}>{identity}</GridPerson>
              ) : (
                identity
              )}
              {stage && <Badge>{stage}</Badge>}
            </div>
            {facts.length > 0 && (
              <dl className="record-card-facts">
                {facts.map((field) => (
                  <div key={field.key}>
                    <dt>{columnHeading(view, field.name)}</dt>
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
