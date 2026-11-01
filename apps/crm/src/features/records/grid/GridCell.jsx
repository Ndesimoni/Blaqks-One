import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatValue } from '../../../lib/crm.js';
import { initials } from '../../../lib/records.js';
import { KeptChip } from '../KeptChip.jsx';
import './grid-person.css';

const stageName = /stage|status|tier|priority/i;
const strongName = /Full name|Listing title|Next action|Community/i;

/** A person's name with initials, as in the mockup's people columns; the initials are decoration. */
export function GridPerson({ name, children }) {
  return (
    <span className="grid-person">
      <span className="grid-avatar" aria-hidden="true">
        {initials(name)}
      </span>
      {children}
    </span>
  );
}

/** One table cell: ID first, stages as badges, names emphasised, everything else as text. */
export function GridCell({ data, module, record, field, first }) {
  const value = formatValue(data, module, record, field);
  if (stageName.test(field.name)) return <Badge>{value}</Badge>;
  if (first)
    return (
      <>
        <span className="mono id-link">{value}</span>
        <KeptChip module={module} record={record} />
      </>
    );
  if (!strongName.test(field.name)) return value;
  const strong = <span className="cell-strong">{value}</span>;
  return field.name === 'Full name' && value !== '—' ? (
    <GridPerson name={value}>{strong}</GridPerson>
  ) : (
    strong
  );
}
