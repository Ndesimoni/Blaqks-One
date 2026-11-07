import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { StateSkeleton, StateView } from '../../../components/ui/StateView.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { hasPlatformArea } from '../platformAccess.js';
import { ClientForm } from './ClientForm.jsx';
import { ClientSlider } from './ClientSlider.jsx';
import { ClientsGrid } from './ClientsGrid.jsx';
import { ClientsToolbar } from './ClientsToolbar.jsx';
import { clientName } from './clientsModel.js';
import { useClientOwners } from './useClientOwners.js';
import { usePlatformClients } from './usePlatformClients.js';
import './platform-clients.css';

const allView = { stage: 'all', query: '', owner: 'all' };

/**
 * Platform → Clients (BO1e, docs/blaqks-one-console.md §9): Blaqks One's own sales list of
 * brokerages and agents, as the CRM's grid with stage presets, search and an Assigned
 * filter. A row opens the client slider; Add client, and every change inside the slider, need
 * Manage on Blaqks One clients. No listings, no property fields, never a company's records.
 */
export function PlatformClientsPage() {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const { user } = useSession();
  const { setToast } = useWorkspaceView();
  const manage = hasPlatformArea(user, 'clients', 'manage');
  const [view, setView] = useState(allView);
  const [openId, setOpenId] = useState('');
  const [adding, setAdding] = useState(false);
  const list = usePlatformClients(view);
  const owners = useClientOwners(manage);
  const add = manage ? () => setAdding(true) : null;
  const added = (client) => {
    setAdding(false);
    list.reload();
    setToast(k('added', { name: clientName(client) }));
    setOpenId(client.id);
  };
  const filtered = view.stage !== 'all' || view.owner !== 'all' || Boolean(view.query.trim());
  let body;
  if (list.error && !list.rows)
    body = (
      <StateView tone="error" role="alert" icon="close" title={k('loadFailed')} detail={list.error}>
        <Button onClick={list.reload}>{k('retry')}</Button>
      </StateView>
    );
  else if (!list.rows) body = <StateSkeleton label={k('loading')} rows={6} />;
  else if (!list.rows.length && !filtered && !list.loading)
    body = (
      <StateView icon="briefcase" title={k('none')} detail={manage ? k('noneHint') : k('noneView')}>
        {add && (
          <Button icon="plus" onClick={add}>
            {k('addFirst')}
          </Button>
        )}
      </StateView>
    );
  else body = <ClientsGrid list={list} stage={view.stage} onOpen={setOpenId} />;
  return (
    <div className="page-stack platform-clients">
      <ClientsToolbar view={view} counts={list.counts} onView={setView} onAdd={add} />
      {list.error && list.rows && (
        <p className="field-error platform-clients-alert" role="alert">
          {list.error}{' '}
          <Button variant="light" onClick={list.reload}>
            {k('retry')}
          </Button>
        </p>
      )}
      {body}
      {openId && (
        <ClientSlider
          key={openId}
          id={openId}
          manage={manage}
          owners={owners}
          onChanged={list.reload}
          onToast={setToast}
          onClose={() => setOpenId('')}
        />
      )}
      {adding && <ClientForm owners={owners} onClose={() => setAdding(false)} onSaved={added} />}
    </div>
  );
}
