import React, { useId, useMemo, useState } from 'react';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { PanelHead } from './PanelHead.jsx';
import { linkCandidates } from './triageModel.js';

/** Link to existing client or contact (design DesktopTriage). */
export function LinkRecordPanel({ onLink, onClose, onDone }) {
  const { t } = useI18n();
  const { entries } = useRecords();
  const id = useId();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => linkCandidates(entries, query), [entries, query]);
  const choose = async (row) => {
    setBusy(true);
    const failure = await onLink(row.collection, row.id);
    setBusy(false);
    if (failure) setError(failure);
    else onDone();
  };
  return (
    <aside
      className="inbox-panel"
      aria-label={t('inboxTriage.link.title')}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      <PanelHead title={t('inboxTriage.link.title')} onClose={onClose} />
      <div className="inbox-panel-section">
        <label htmlFor={`${id}-search`}>{t('inboxTriage.link.search')}</label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          placeholder={t('inboxTriage.link.placeholder')}
          onChange={(event) => setQuery(event.target.value)}
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {rows.length === 0 ? (
          <p className="inbox-panel-hint">{t('inboxTriage.link.none')}</p>
        ) : (
          <ul className="inbox-link-results">
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" disabled={busy} onClick={() => choose(row)}>
                  <strong>{row.name || row.legacy}</strong>
                  <small>
                    {t(`inboxTriage.link.${row.collection}`)} · <bdi>{row.legacy}</bdi>
                    {row.phone && (
                      <>
                        {' '}
                        · <bdi>{row.phone}</bdi>
                      </>
                    )}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
