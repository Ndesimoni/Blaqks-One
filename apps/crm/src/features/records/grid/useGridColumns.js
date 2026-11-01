import { useMemo } from 'react';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { defaultColumns, mockupGrids } from './columnsModel.js';
import { gridFields } from './gridFields.js';
import { useStoredColumns } from './useStoredColumns.js';

const storageKey = (viewer, module) => `kws-grid-columns:${viewer || 'viewer'}:${module}`;

/**
 * The columns one viewer sees in a directory (the grid's column chooser). Only presentation:
 * records, sorting, exports and workbook mappings are unchanged.
 */
export function useGridColumns(module, viewer) {
  const added = useRecords()?.gridColumns?.[module];
  const fields = useMemo(() => gridFields(module, added), [module, added]);
  // Added columns are rebuilt with the records; re-read the choice only when names change.
  const nameList = fields.map((field) => field.name).join('\n');
  const names = useMemo(() => nameList.split('\n'), [nameList]);
  const fallback = useMemo(() => defaultColumns(module), [module]);
  // A mockup grid's ID is an ordinary column; other tables keep theirs first.
  const fixed = mockupGrids.has(module) ? null : names[0];
  const stored = useStoredColumns(storageKey(viewer, module), names, fallback, fixed);
  return { fields, identity: fixed, ...stored };
}
