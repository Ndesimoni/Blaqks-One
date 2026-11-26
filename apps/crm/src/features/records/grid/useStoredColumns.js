import { useCallback, useEffect, useState } from 'react';
import { cleanColumns, sameColumns, toggleColumn } from './columnsModel.js';

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
 * One viewer's remembered column choice under `key` (a grid's column chooser): names kept to
 * `names`, `fallback` as the default, and an optional `fixed` column that always leads.
 */
export function useStoredColumns(key, names, fallback, fixed = null) {
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
    columns,
    isDefault: sameColumns(columns, fallback),
    toggle: (name) => choose(toggleColumn(columns, name, fixed)),
    reset: () => choose(fallback),
  };
}
