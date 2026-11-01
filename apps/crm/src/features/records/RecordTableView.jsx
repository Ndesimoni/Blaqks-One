import React, { useRef } from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { get } from '../../lib/records.js';
import { columnHeading } from './grid/columnHeadings.js';
import { cellText } from './grid/gridFields.js';
import { GridCell } from './grid/GridCell.jsx';
import { SelectPageCell, SelectRowCell } from './grid/GridSelect.jsx';
import { useWideTable } from './grid/useWideTable.js';
import { RecordRowActions } from './RecordRowActions.jsx';

const ariaSort = (sort, field) =>
  sort.key === field.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';

/**
 * Desktop directory presentation: the sortable table inside the grid card. A table that fits
 * keeps its header row in view while the page scrolls; a wider one scrolls sideways in a
 * labelled, keyboard-reachable region instead. `gridRows` draws the approved mockup's rows: an
 * optional select column, the first cell opening the record and no row buttons.
 */
export function RecordTableView({
  module,
  data,
  current,
  pick,
  columns,
  sort,
  setSort,
  setPage,
  dispatchRow,
  readOnly,
  tableLabel,
  gridRows = false,
  selection = null,
}) {
  const scroll = useRef(null);
  const wide = useWideTable(scroll);
  const idOf = (record) => get(record, columns[0].name);
  const nameOf = (record) => {
    const value = cellText(data, module, record, pick[0]);
    return value === '—' ? idOf(record) : value;
  };
  return (
    <div
      ref={scroll}
      className={'table-scroll grid-scroll' + (wide ? ' is-wide' : '')}
      role="region"
      aria-label={`${module} records table`}
      tabIndex={wide ? 0 : undefined}
    >
      <table className="data-table grid-table" aria-label={tableLabel || `${module} records`}>
        <thead>
          <tr>
            {selection && <SelectPageCell rows={current} selection={selection} />}
            {pick.map((f) =>
              f.virtual ? (
                <th key={f.key} scope="col">
                  {columnHeading(module, f.name)}
                </th>
              ) : (
                <th key={f.key} scope="col" aria-sort={ariaSort(sort, f)}>
                  <button
                    type="button"
                    className="table-sort"
                    onClick={() => {
                      setSort((s) => ({
                        key: f.key,
                        direction: s.key === f.key && s.direction === 'asc' ? 'desc' : 'asc',
                      }));
                      setPage(0);
                    }}
                  >
                    {columnHeading(module, f.name)}{' '}
                    {sort.key === f.key && (
                      <Icon name={sort.direction === 'asc' ? 'up' : 'down'} size={12} />
                    )}
                  </button>
                </th>
              ),
            )}
            {!gridRows && (
              <th className="last-th">
                <span className="sr-only">Open record</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {current.map((r, i) => (
            <tr
              key={idOf(r) || i}
              className={selection?.isSelected(r) ? 'is-selected' : undefined}
              onClick={() => dispatchRow(module, r)}
            >
              {selection && <SelectRowCell record={r} name={nameOf(r)} selection={selection} />}
              {pick.map((f) => (
                <td key={f.key}>
                  <GridCell
                    data={data}
                    module={module}
                    record={r}
                    field={f}
                    first={f === pick[0]}
                    open={gridRows}
                    id={idOf(r)}
                  />
                </td>
              ))}
              {!gridRows && (
                <td className="grid-actions">
                  <RecordRowActions module={module} record={r} id={idOf(r)} readOnly={readOnly} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
