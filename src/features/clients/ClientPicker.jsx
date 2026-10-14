import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Empty } from '../../components/ui/Empty.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { get, initials } from '../../lib/records.js';
import { useRecordAccess } from '../records/useRecordAccess.js';

/** Client desk search list; Add client appears only when Clients may be created. */
export function ClientPicker({ clients, client }) {
  const { query, setQuery, setSelectedClient } = useWorkspaceView();
  const { add } = useWorkspaceActions();
  const can = useRecordAccess();
  return (
    <section className="panel desk-list">
      <div className="desk-list-title">
        <h3>Find a client</h3>
        <span>
          {clients.length} {clients.length === 1 ? 'contact' : 'contacts'}
        </span>
      </div>
      <div className="search-small desk-search">
        <Icon name="search" size={17} />
        <input
          aria-label="Search clients in client desk"
          placeholder="Name, phone or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <OverflowList
        mode="scroll"
        className="client-picker-list"
        key={query}
        items={clients}
        getKey={(c) => get(c, 'Client ID')}
        activeKey={client && get(client, 'Client ID')}
        label="Client desk contacts"
        listClassName="desk-clients"
        renderItem={(c, _index, { close }) => (
          <button
            type="button"
            className={
              'desk-client ' +
              (client && get(c, 'Client ID') === get(client, 'Client ID') ? 'selected' : '')
            }
            onClick={() => {
              setSelectedClient(get(c, 'Client ID'));
              close();
            }}
          >
            <span className="avatar">{initials(get(c, 'Full name'))}</span>
            <div>
              <strong>{get(c, 'Full name')}</strong>
              <small>{get(c, 'Preferred communities') || 'Location not selected'}</small>
            </div>
            <Icon name="chevron" size={16} />
          </button>
        )}
      />
      {!clients.length && <Empty title="No clients found" />}
      {can('Clients', 'create') && (
        <Button variant="light" icon="plus" className="full-width" onClick={() => add('Clients')}>
          Add client
        </Button>
      )}
    </section>
  );
}
