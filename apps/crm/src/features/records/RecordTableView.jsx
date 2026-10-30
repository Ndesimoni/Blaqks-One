import React from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { formatValue } from '../../lib/crm.js';
import { get } from '../../lib/records.js';
import { KeptChip } from './KeptChip.jsx';
import { RecordRowActions } from './RecordRowActions.jsx';

const stageName = /stage|status|tier|priority/i;
const strongName = /Full name|Listing title|Next action|Community/i;

/** Desktop directory presentation: the existing sortable table, in a labelled scroll container. */
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
}) {
  return (
    <div className="table-scroll" role="region" aria-label={`${module} records table`} tabIndex={0}>
      <table className="data-table" aria-label={tableLabel || `${module} records`}>
        <thead>
          <tr>
            {pick.map((f) => (
              <th
                key={f.key}
                scope="col"
                aria-sort={
                  sort.key === f.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  className="table-sort"
                  onClick={() => {
                    setSort((s) => ({
                      key: f.key,
                      direction: s.key === f.key && s.direction === 'asc' ? 'desc' : 'asc',
                    }));
                    setPage(0);
                  }}
                >
                  {f.name.replace(/ AED$/, '')}{' '}
                  {sort.key === f.key && (
                    <Icon name={sort.direction === 'asc' ? 'up' : 'down'} size={12} />
                  )}
                </button>
              </th>
            ))}
            <th className="last-th">
              <span className="sr-only">Open record</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {current.map((r, i) => (
            <tr key={get(r, columns[0].name) || i} onClick={() => dispatchRow(module, r)}>
              {pick.map((f) => (
                <td key={f.key}>
                  {stageName.test(f.name) ? (
                    <Badge>{formatValue(data, module, r, f)}</Badge>
                  ) : f === pick[0] ? (
                    <>
                      <span className="mono id-link">{formatValue(data, module, r, f)}</span>
                      <KeptChip module={module} record={r} />
                    </>
                  ) : strongName.test(f.name) ? (
                    <span className="cell-strong">{formatValue(data, module, r, f)}</span>
                  ) : (
                    formatValue(data, module, r, f)
                  )}
                </td>
              ))}
              <td>
                <RecordRowActions
                  module={module}
                  record={r}
                  id={get(r, columns[0].name)}
                  readOnly={readOnly}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
