import { useMemo } from 'react';
import { useStoredColumns } from '../../records/grid/useStoredColumns.js';

/**
 * The columns one viewer sees in Payments or Expenses (the mockup grid's gear): the view's
 * columns without `extra` by default, the extra ones a tick away. Presentation only.
 */
export function useEntryColumns(kind, viewer, columns) {
  const names = useMemo(() => columns.map((column) => column.label), [columns]);
  const fallback = useMemo(
    () => columns.filter((column) => !column.extra).map((column) => column.label),
    [columns],
  );
  const fields = useMemo(
    () => columns.map((column) => ({ key: column.label, name: column.label })),
    [columns],
  );
  const key = `kws-entry-columns:${viewer || 'viewer'}:${kind}`;
  const stored = useStoredColumns(key, names, fallback);
  const shown = stored.columns
    .map((name) => columns.find((column) => column.label === name))
    .filter(Boolean);
  return { grid: { fields, identity: null, ...stored }, shown };
}
