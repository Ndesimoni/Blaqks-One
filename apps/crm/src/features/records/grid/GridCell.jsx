import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { formatValue } from '../../../lib/crm.js';
import { initials } from '../../../lib/records.js';
import { KeptChip } from '../KeptChip.jsx';
import './grid-open.css';
import './grid-person.css';

const stageName = /stage|status|tier|priority|Client response/i;
const strongName = /Full name|Listing title|Next action|Community|Client name auto/i;
/** Columns holding a person's name, shown with initials as the mockup's person cells. */
export const personColumn = /^(Full name|Client name auto)$/;

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

/** A value as the grid shows it: stages as badges, names emphasised, people with initials. */
function CellValue({ value, field }) {
  if (stageName.test(field.name)) return <Badge>{value}</Badge>;
  if (!strongName.test(field.name)) return value;
  const strong = <span className="cell-strong">{value}</span>;
  return personColumn.test(field.name) && value !== '—' ? (
    <GridPerson name={value}>{strong}</GridPerson>
  ) : (
    strong
  );
}

/**
 * The first cell of a mockup grid row opens the record: it reads as the record's name and is
 * named "Layla Haddad, open record CL-1" (the ID alone when the cell is empty or the ID). Its
 * click reaches the row, which opens the record.
 */
function OpenCell({ module, record, value, field, id }) {
  const { t } = useI18n();
  const shown = value === '—' ? id : value;
  return (
    <>
      <button
        type="button"
        className="grid-open"
        aria-label={
          shown === id
            ? t('recordGrid.openId', { id })
            : t('recordGrid.openNamed', { name: shown, id })
        }
      >
        {shown === id ? (
          <span className="mono id-link">{id}</span>
        ) : (
          <CellValue value={value} field={field} />
        )}
      </button>
      <KeptChip module={module} record={record} />
    </>
  );
}

/**
 * One table cell. `first` marks a table's lead cell: an ID with its view-only chip, or on a
 * mockup grid (`open`) the button that opens the record.
 */
export function GridCell({ data, module, record, field, first, open = false, id }) {
  const value = formatValue(data, module, record, field);
  if (first && open)
    return <OpenCell module={module} record={record} value={value} field={field} id={id} />;
  if (first)
    return (
      <>
        <span className="mono id-link">{value}</span>
        <KeptChip module={module} record={record} />
      </>
    );
  return <CellValue value={value} field={field} />;
}
