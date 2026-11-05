import React, { useId, useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import { GridFoot } from '../../records/grid/GridFoot.jsx';
import '../../records/grid/grid-card.css';
import '../../records/grid/grid-open.css';

const PER_PAGE = 20;
const TONES = { active: 'green', suspended: 'amber', archived: 'slate' };
const COLUMNS = [
  'company',
  'admin',
  'joined',
  'status',
  'seats',
  'active',
  'lastActive',
  'records',
];
const NUMERIC = ['seats', 'active', 'records'];

/**
 * Each company's usage (BO1d §3 item 4): Admin, joined, status, seats, active users in 30 days,
 * last active and its record total. Never money, client names or records by type. Searchable
 * by company or Admin; a row opens the company panel from Platform → Companies.
 */
export function CompanyUsage({ rows, onOpen }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformMetrics.${key}`, vars);
  const headingId = useId();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const needle = query.trim().toLowerCase();
  const found = rows.filter(
    (row) => !needle || `${row.name} ${row.admin ?? ''}`.toLowerCase().includes(needle),
  );
  const current = Math.min(page, Math.max(0, Math.ceil(found.length / PER_PAGE) - 1));
  const shown = found.slice(current * PER_PAGE, (current + 1) * PER_PAGE);
  const count = (value) => (value === null ? '—' : format.number(value));
  const cells = (row) => ({
    admin: row.admin ?? '—',
    joined: format.date(row.createdOn),
    status: (
      <Badge tone={TONES[row.status]}>
        {t(`platformCompanies.status.${row.status}`) || row.status}
      </Badge>
    ),
    seats:
      row.seatLimit === null
        ? k('seatsOpen', { used: count(row.seatsUsed) })
        : k('seats', { used: count(row.seatsUsed), limit: row.seatLimit }),
    active: count(row.activeUsers30d),
    lastActive: row.lastActiveAt ? format.date(row.lastActiveAt) : k('never'),
    records: count(row.records),
  });
  const preset = k('usage.preset');
  return (
    <section className="platform-usage" aria-labelledby={headingId}>
      <div className="platform-usage-head">
        <h2 id={headingId}>{k('usage.title')}</h2>
        <p>{k('usage.caption')}</p>
      </div>
      <GridFilterBar
        module={k('usage.module')}
        presetLabel={preset}
        tabs={[preset]}
        tab={preset}
        onTab={() => {}}
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(0);
        }}
      />
      <div className="grid-card">
        {shown.length ? (
          <div className="table-scroll">
            <table className="data-table grid-table usage-table" aria-label={k('usage.table')}>
              <thead>
                <tr>
                  {COLUMNS.map((key) => (
                    <th key={key} scope="col" className={NUMERIC.includes(key) ? 'usage-num' : ''}>
                      {k(`col.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const values = cells(row);
                  return (
                    <tr key={row.id} onClick={() => onOpen(row.id)}>
                      <td>
                        {/* Its click reaches the row, which opens the company. */}
                        <button
                          type="button"
                          className="grid-open"
                          aria-label={k('openNamed', { name: row.name })}
                        >
                          <span className="cell-strong">{row.name}</span>
                        </button>
                      </td>
                      {COLUMNS.slice(1).map((key) => (
                        <td key={key} className={NUMERIC.includes(key) ? 'usage-num' : ''}>
                          {values[key]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon="building"
            title={rows.length ? k('usage.none') : k('usage.empty')}
            detail={rows.length ? k('usage.noneHint') : k('usage.emptyHint')}
          />
        )}
        <GridFoot
          total={found.length}
          page={current}
          perPage={PER_PAGE}
          label={k('usage.pages')}
          onPage={setPage}
        />
      </div>
    </section>
  );
}
