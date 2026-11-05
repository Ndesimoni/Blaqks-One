import React, { useId } from 'react';
import { useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { initials } from '../../../lib/records.js';
import '../../records/grid/grid-card.css';
import '../../records/grid/grid-open.css';
import '../../records/grid/grid-person.css';
import { todayAgenda } from './kpiModel.js';

/**
 * The approved mockup's Today table: open follow-ups due today and viewings booked today, by
 * time, with the client. Clicking a row (or its first cell's button) opens the record.
 * `clientName` and `propertyName` use the viewer's permitted names only.
 */
export function TodayAgenda({ data, today, clientName, propertyName }) {
  const { t } = useI18n();
  const { dispatchRow } = useWorkspaceActions();
  const headingId = useId();
  const rows = todayAgenda(data, today);
  const what = (row) =>
    row.module === 'Viewings'
      ? t('dashboard.viewingOf', { property: propertyName(row.propertyId) })
      : row.what || t('recordGrid.untitled');
  return (
    <section className="dashboard-today" aria-labelledby={headingId}>
      <h2 id={headingId} className="dashboard-section-title">
        {t('dashboard.today')}
      </h2>
      <div className="grid-card">
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table grid-table today-table" aria-labelledby={headingId}>
              <thead>
                <tr>
                  <th scope="col">{t('dashboard.when')}</th>
                  <th scope="col">{t('dashboard.what')}</th>
                  <th scope="col">{t('dashboard.client')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const client = row.clientId ? clientName(row.clientId) : '—';
                  return (
                    <tr
                      key={`${row.module}-${index}`}
                      onClick={() => dispatchRow(row.module, row.record)}
                    >
                      <td className="today-when">{row.time || t('dashboard.allDay')}</td>
                      <td>
                        {/* Its click reaches the row, which opens the record. */}
                        <button type="button" className="grid-open">
                          <span className="cell-strong">{what(row)}</span>
                        </button>
                      </td>
                      <td>
                        <span className="grid-person">
                          <span className="grid-avatar" aria-hidden="true">
                            {initials(client)}
                          </span>
                          <span>{client}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dashboard-today-empty">{t('dashboard.nothingToday')}</p>
        )}
      </div>
    </section>
  );
}
