import React, { useContext } from 'react';
import { RecordsContext } from '../../app/WorkspaceContext.js';
import { get } from '../../lib/records.js';

const collectionOf = {
  'Client ID': 'Clients',
  'Property ID': 'Properties',
  'Contact ID': 'Contacts',
};

/**
 * Link picker for related records. Options come only from the visible workspace data. In connected
 * mode a linked ID the caller cannot open is labelled from `referenceFor` as the current value only;
 * references and task clients are never listed as choices (assignments contract M1).
 */
export function LinkSelect({ field, module, relation, value, inputProps, change }) {
  const records = useContext(RecordsContext);
  const known = relation.data.some((row) => get(row, relation.id) === value);
  const reference =
    value && !known ? records?.referenceFor?.(collectionOf[relation.id], value) : null;
  // Only the client's holder may move a follow-up that is directly assigned to the caller.
  const locked = Boolean(reference?.taskClient && module === 'Follow-ups');
  const hintId = `${field.key}-link-hint`;
  const describedBy = [inputProps['aria-describedby'], locked ? hintId : null]
    .filter(Boolean)
    .join(' ');
  return (
    <>
      <select
        {...inputProps}
        aria-describedby={describedBy || undefined}
        id={field.key}
        value={value}
        disabled={locked || undefined}
        className={locked ? 'link-locked' : undefined}
        onChange={(event) => change(field.key, event.target.value)}
      >
        <option value="">Select {field.name.toLowerCase()}</option>
        {value && !known && (
          <option value={value}>
            {reference ? reference.label : `${value} · Linked record unavailable`}
          </option>
        )}
        {relation.data.map((row) => (
          <option key={get(row, relation.id)} value={get(row, relation.id)}>
            {get(row, relation.id)} · {get(row, relation.name)}
          </option>
        ))}
      </select>
      {locked && (
        <small id={hintId} className="field-hint">
          Only the client's assignee can change this link.
        </small>
      )}
    </>
  );
}
