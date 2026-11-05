import React, { useRef } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridPerson } from '../../records/grid/GridCell.jsx';
import { useWideTable } from '../../records/grid/useWideTable.js';
import { FollowUpDate, OwnerName, SourceName, StagePill } from './ClientCells.jsx';
import { clientName } from './clientsModel.js';

const COLUMNS = ['company', 'contact', 'stage', 'nextFollowUp', 'owner', 'source', 'updated'];

/**
 * The desktop grid, drawn as the CRM's mockup rows: the company cell opens the client (and is
 * its keyboard stop), the whole row is clickable, the contact shows with initials and the
 * stage as a pill. A table wider than its card scrolls sideways in a labelled region.
 */
export function ClientsTable({ rows, onOpen }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const scroll = useRef(null);
  const wide = useWideTable(scroll);
  return (
    <div
      ref={scroll}
      className={'table-scroll grid-scroll' + (wide ? ' is-wide' : '')}
      role="region"
      aria-label={k('tableRegion')}
      tabIndex={wide ? 0 : undefined}
    >
      <table className="data-table grid-table platform-clients-table" aria-label={k('table')}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col">
                {k(`col.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((client) => (
            <tr key={client.id} onClick={() => onOpen(client.id)}>
              <td>
                <button
                  type="button"
                  className="grid-open"
                  aria-label={k('openNamed', { name: clientName(client) })}
                >
                  <span className="cell-strong">{clientName(client)}</span>
                </button>
              </td>
              <td>
                {client.contactName ? (
                  <GridPerson name={client.contactName}>{client.contactName}</GridPerson>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                <StagePill stage={client.stage} />
              </td>
              <td>
                <FollowUpDate value={client.nextFollowUp} />
              </td>
              <td>
                <OwnerName client={client} />
              </td>
              <td>
                <SourceName source={client.source} />
              </td>
              <td>{client.updatedAt ? format.date(client.updatedAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
