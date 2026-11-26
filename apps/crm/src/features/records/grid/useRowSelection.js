import { useMemo, useState } from 'react';

/**
 * The grid's ticked rows (the mockup's select column), kept by record ID. Only rows still in the
 * filtered list count as selected, so a search or preset narrows the selection with the rows.
 */
export function useRowSelection(records, idOf) {
  const [ids, setIds] = useState(() => new Set());
  const selected = useMemo(
    () => records.filter((record) => ids.has(idOf(record))),
    [records, ids, idOf],
  );
  const change = (rows, tick) =>
    setIds((current) => {
      const next = new Set(current);
      for (const row of rows) (tick ? next.add : next.delete).call(next, idOf(row));
      return next;
    });
  return {
    selected,
    isSelected: (record) => ids.has(idOf(record)),
    toggle: (record) => change([record], !ids.has(idOf(record))),
    /** Ticks every row of the page, or unticks them all when each is already ticked. */
    togglePage: (rows) => change(rows, !rows.every((row) => ids.has(idOf(row)))),
    clear: () => setIds(new Set()),
  };
}
