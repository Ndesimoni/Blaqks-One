import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useNavigate } from 'react-router-dom';
import { routePath } from '../../../config/routes.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import '../../records/grid/grid-filter.css';
import { usePlatformCompanies } from './usePlatformCompanies.js';

const MARKET_TONES = { approved: 'green', pending: 'amber', declined: 'red', revoked: 'red' };

/**
 * Platform → Workspaces as the approved mockup's Companies grid (design queue item 33), for the
 * Super Admin: Active companies or Archived, searchable, each with its Admin, seats and
 * marketplace state. Open goes to the company's Team & access, where its seat limit and
 * archive live. No company's records are read here.
 */
export function ServerWorkspaces() {
  const { t, format } = useI18n();
  const go = useNavigate();
  // The connected app selects a workspace by the address, as the workspace banner does.
  const open = (id) =>
    go({
      pathname: routePath('Team & access'),
      search: `?${new URLSearchParams({ workspace: id })}`,
    });
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
    </div>
  );
}
