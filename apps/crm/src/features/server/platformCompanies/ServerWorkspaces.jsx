import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import '../../records/grid/grid-filter.css';
import { usePlatformCompanies } from './usePlatformCompanies.js';
import { CompanyPanel } from './CompanyPanel.jsx';

const MARKET_TONES = { approved: 'green', pending: 'amber', declined: 'red', revoked: 'red' };

/**
 * Platform → Companies as the approved mockup's grid (design queue item 33), for Blaqks One:
 * Active companies or Archived, searchable, each with its Admin, seats and marketplace state.
 * Open shows the company panel (people, seat limit, suspend and archive); Blaqks One never
 * enters a company or reads its records (BO1a).
 */
export function ServerWorkspaces() {
  const { t, format } = useI18n();
  const { setToast } = useWorkspaceView();
  const [openId, setOpenId] = useState('');
  const open = (id) => setOpenId(id);
  const list = usePlatformCompanies();
  const [view, setView] = useState({ archived: false, query: '' });
  const k = (key, vars) => t(`platformCompanies.${key}`, vars);
  if (list.error && !list.rows)
    return (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{list.error}</p>
        <Button onClick={list.reload}>{k('retry')}</Button>
      </section>
    );
  if (!list.rows) return <p role="status">{k('loading')}</p>;
  const needle = view.query.trim().toLowerCase();
  const rows = list.rows.filter(
    (row) =>
      (row.status === 'archived') === view.archived &&
      (!needle || `${row.name} ${row.admin}`.toLowerCase().includes(needle)),
  );
  const tabs = [k('active'), k('archived')];
  return (
    <div className="page-stack platform-companies">
      <GridFilterBar
        module={k('module')}
        presetLabel={tabs[Number(view.archived)]}
        tabs={tabs}
        tab={tabs[Number(view.archived)]}
        onTab={(name) => setView({ ...view, archived: name === tabs[1] })}
        query={view.query}
        onQuery={(query) => setView({ ...view, query })}
      />
      {!rows.length ? (
        <section className="panel">
          <Empty icon="building" title={k('none')} detail={k('noneHint')} />
        </section>
      ) : (
        <div className="table-shell">
          <div className="table-scroll">
            <table className="data-table" aria-label={k('table')}>
              <thead>
                <tr>
                  {['company', 'admin', 'seats', 'marketplace', 'created', 'open'].map((key) => (
                    <th key={key} scope="col">
                      {k(`col.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>{row.admin}</td>
                    <td>
                      {row.seatLimit === null
                        ? k('seatsOpen', { used: row.seatsUsed })
                        : k('seats', { used: row.seatsUsed, limit: row.seatLimit })}
                    </td>
                    <td>
                      <Badge tone={MARKET_TONES[row.marketplace] || 'slate'}>
                        {t(`marketplace.states.${row.marketplace}`)}
                      </Badge>
                    </td>
                    <td>{format.date(row.createdOn)}</td>
                    <td>
                      <Button
                        variant="light"
                        aria-label={k('openNamed', { name: row.name })}
                        onClick={() => open(row.id)}
                      >
                        {k('open')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {openId && list.rows?.some((row) => row.id === openId) && (
        <CompanyPanel
          company={list.rows.find((row) => row.id === openId)}
          onClose={() => setOpenId('')}
          onChanged={list.reload}
          onToast={setToast}
        />
      )}
    </div>
  );
}
