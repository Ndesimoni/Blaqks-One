import { formatValue } from '../../../lib/crm.js';
import { schema } from '../../../lib/schema.js';

/**
 * A grid's columns: the sheet's fields, then any the page adds that are not stored on the record
 * (connected Clients' Agent, from each client's assignment). Added columns are display only:
 * they are not sorted, searched, imported or exported.
 */
export const gridFields = (module, added = []) => [...schema(module), ...added];

/** A cell's text: an added column asks the page; a sheet column formats the stored value. */
export const cellText = (data, module, record, field) =>
  field.virtual ? field.value(record) || '—' : formatValue(data, module, record, field);
