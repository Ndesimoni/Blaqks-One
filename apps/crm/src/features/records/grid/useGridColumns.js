import { useCallback, useEffect, useMemo, useState } from 'react';
import { schema } from '../../../lib/schema.js';
import {
  cleanColumns,
  defaultColumns,
  mockupGrids,
  sameColumns,
  toggleColumn,
} from './columnsModel.js';

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
  const fields = useMemo(() => schema(module), [module]);
  const names = useMemo(() => fields.map((field) => field.name), [fields]);
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
