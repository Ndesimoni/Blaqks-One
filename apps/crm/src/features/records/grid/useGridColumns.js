import { useCallback, useEffect, useMemo, useState } from 'react';
import { schema } from '../../../lib/schema.js';
import { cleanColumns, defaultColumns, sameColumns, toggleColumn } from './columnsModel.js';

const storageKey = (viewer, module) => `kws-grid-columns:${viewer || 'viewer'}:${module}`;

// Columns are a per-viewer convenience; storage may be unavailable or hold an old entry.
function read(key, names, fallback) {
  try {
    return cleanColumns(JSON.parse(localStorage.getItem(key) || 'null'), names, fallback);
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
  const key = storageKey(viewer, module);
  const [columns, setColumns] = useState(() => read(key, names, fallback));
  useEffect(() => setColumns(read(key, names, fallback)), [key, names, fallback]);
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
    identity: names[0],
    isDefault: sameColumns(columns, fallback),
    toggle: (name) => choose(toggleColumn(columns, name, names[0])),
    reset: () => choose(fallback),
  };
}
