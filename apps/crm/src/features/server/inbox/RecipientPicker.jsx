import React, { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { emailRecipients } from './composerModel.js';

/** Choose one Client or Contact with an email address the member may see (E1d). */
export function RecipientPicker({ id, chosen, onChoose }) {
  const { t } = useI18n();
  const { entries } = useRecords();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => emailRecipients(entries, query), [entries, query]);
  if (chosen)
    return (
      <div className="inbox-start-chosen">
        <span>
          <strong>{chosen.name || chosen.legacy}</strong>
          <small>
            <bdi>{chosen.email}</bdi>
          </small>
        </span>
        <Button variant="light" onClick={() => onChoose(null)}>
          {t('inboxSend.start.change')}
        </Button>
      </div>
    );
  return (
    <>
      <input
        id={id}
        type="search"
        data-initial-focus
        value={query}
        placeholder={t('inboxSend.start.placeholder')}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setQuery(event.target.value)}
      />
      <span id={`${id}-hint`} className="sr-only">
        {t('inboxSend.start.search')}
      </span>
      {rows.length === 0 ? (
        <p className="inbox-panel-hint">{t('inboxSend.start.none')}</p>
      ) : (
        <ul className="inbox-link-results" aria-label={t('inboxSend.start.search')}>
          {rows.map((row) => (
            <li key={`${row.collection}-${row.id}`}>
              <button type="button" onClick={() => onChoose(row)}>
                <strong>{row.name || row.legacy}</strong>
                <small>
                  {t(`inboxTriage.link.${row.collection}`)} · <bdi>{row.email}</bdi>
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
