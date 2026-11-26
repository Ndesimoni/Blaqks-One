import React, { useId } from 'react';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { get, initials } from '../../../lib/records.js';
import '../../records/grid/grid-person.css';
import { clientNeed } from './clientDeskModel.js';

/**
 * The desk's client picker (approved mockup): "Find a client", then each client with their
 * initials, name and what they look for, the chosen one marked. On phones the list gives way to
 * one Client select under the same search, as in the mockup.
 */
export function DeskClientList({ clients, client }) {
  const { t } = useI18n();
  const { query, setQuery, setSelectedClient } = useWorkspaceView();
  const id = useId();
  const chosen = client ? get(client, 'Client ID') : '';
  const name = (row) => get(row, 'Full name') || get(row, 'Client ID');
  return (
    <aside className="client-desk-list" aria-label={t('clientDesk.clients')}>
      <label className="sr-only" htmlFor={`${id}-find`}>
        {t('clientDesk.find')}
      </label>
      <input
        id={`${id}-find`}
        type="search"
        placeholder={t('clientDesk.find')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {clients.length > 0 ? (
        <>
          <OverflowList
            mode="scroll"
            className="client-desk-scroll"
            key={query}
            items={clients}
            getKey={(row) => get(row, 'Client ID')}
            activeKey={chosen}
            label={t('clientDesk.clients')}
            listClassName="client-desk-rows"
            renderItem={(row, _index, { close }) => (
              <button
                type="button"
                className="client-desk-row"
                aria-current={get(row, 'Client ID') === chosen ? 'true' : undefined}
                onClick={() => {
                  setSelectedClient(get(row, 'Client ID'));
                  close();
                }}
              >
                <span className="grid-avatar" aria-hidden="true">
                  {initials(name(row))}
                </span>
                <span>
                  <strong>{name(row)}</strong>
                  <small>{clientNeed(row) || t('clientDesk.needNone')}</small>
                </span>
              </button>
            )}
          />
          <label className="field client-desk-select">
            {t('clientDesk.client')}
            <select value={chosen} onChange={(event) => setSelectedClient(event.target.value)}>
              {clients.map((row) => (
                <option key={get(row, 'Client ID')} value={get(row, 'Client ID')}>
                  {name(row)}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p className="client-desk-empty">{t('clientDesk.noneFound')}</p>
      )}
    </aside>
  );
}
