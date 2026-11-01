import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecords } from '../../../hooks/useWorkspace.js';
import {
  cleanColumns,
  defaultColumns,
  mockupGrids,
  sameColumns,
  toggleColumn,
} from './columnsModel.js';
import { gridFields } from './gridFields.js';

const storageKey = (viewer, module) => `kws-grid-columns:${viewer || 'viewer'}:${module}`;

// Columns are a per-viewer convenience; storage may be unavailable or hold an old entry.
function read(key, names, fallback, fixed) {
  try {
    return cleanColumns(JSON.parse(localStorage.getItem(key) || 'null'), names, fallback, fixed);
  } catch {
    return fallback;
  }
}

function remember(key, columns, fallback) {
  try {
    if (sameColumns(columns, fallback)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(columns));
  } catch {
    // Not remembered; the choice still applies until the page reloads.
  }
}

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
  const key = storageKey(viewer, module);
  const [columns, setColumns] = useState(() => read(key, names, fallback, fixed));
  useEffect(() => setColumns(read(key, names, fallback, fixed)), [key, names, fallback, fixed]);
  const choose = useCallback(
    (next) => {
      setColumns(next);
      remember(key, next, fallback);
    },
    [key, fallback],
  );
  return {
    fields,
    columns,
    identity: fixed,
    isDefault: sameColumns(columns, fallback),
    toggle: (name) => choose(toggleColumn(columns, name, fixed)),
    reset: () => choose(fallback),
  };
}
