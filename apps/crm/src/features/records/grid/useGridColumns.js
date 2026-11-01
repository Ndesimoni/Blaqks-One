import { useMemo } from 'react';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { defaultColumns, mockupGrids } from './columnsModel.js';
import { gridFields } from './gridFields.js';
import { useStoredColumns } from './useStoredColumns.js';

const storageKey = (viewer, module) => `kws-grid-columns:${viewer || 'viewer'}:${module}`;

/**
 * The columns one viewer sees in a directory (the grid's column chooser). Only presentation:
 * records, sorting, exports and workbook mappings are unchanged. `view` names a presentation
 * of another sheet (Leads over Clients) with its own defaults and remembered choice; `added`
 * are the page's display-only columns, beside any the records context adds.
 */
export function useGridColumns(module, viewer, { view = module, added: pageAdded } = {}) {
  const contextAdded = useRecords()?.gridColumns?.[module];
  const added = useMemo(
    () => [...(contextAdded || []), ...(pageAdded || [])],
    [contextAdded, pageAdded],
  );
  const fields = useMemo(() => gridFields(module, added), [module, added]);
  // Added columns are rebuilt with the records; re-read the choice only when names change.
  const nameList = fields.map((field) => field.name).join('\n');
  const names = useMemo(() => nameList.split('\n'), [nameList]);
  const fallback = useMemo(() => defaultColumns(view), [view]);
  // A mockup grid's ID is an ordinary column; other tables keep theirs first.
  const fixed = mockupGrids.has(view) ? null : names[0];
  const stored = useStoredColumns(storageKey(viewer, view), names, fallback, fixed);
  return { fields, identity: fixed, ...stored };
}
