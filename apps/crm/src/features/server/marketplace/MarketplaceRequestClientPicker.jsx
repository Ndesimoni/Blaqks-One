import React, { useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMyClients } from './useMyClients.js';

/** Search the poster's own clients and pick one (packet MK2). */
export function MarketplaceRequestClientPicker({ onPick }) {
  const { t } = useI18n();
  const { clients, loading, error } = useMyClients(true);
  const [search, setSearch] = useState('');
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const found = needle
      ? clients.filter((client) => client.name.toLowerCase().includes(needle))
      : clients;
    return found.slice(0, 50);
  }, [clients, search]);
  return (
    <div className="market-picker">
      <div className="field">
        <label htmlFor="market-client-search">{t('marketplaceRequests.post.client')}</label>
        <input
          id="market-client-search"
          type="search"
          placeholder={t('marketplaceRequests.post.searchClients')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {loading && <p role="status">{t('marketplaceRequests.post.picking')}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && !shown.length && (
        <p className="market-empty">{t('marketplaceRequests.post.noClients')}</p>
      )}
      <ul className="market-client-list">
        {shown.map((client) => (
          <li key={client.id}>
            <button type="button" className="market-client" onClick={() => onPick(client.id)}>
              {client.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
