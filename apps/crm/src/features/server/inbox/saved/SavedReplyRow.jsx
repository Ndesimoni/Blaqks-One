import React, { useState } from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';

/** One saved reply in Manage, with Edit and a Remove that asks first (designer spec §3). */
export function SavedReplyRow({ item, company, canChange, onEdit, onRemove }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const title = item.title;
  const remove = async () => {
    setBusy(true);
    const failure = await onRemove();
    setBusy(false);
    if (failure) {
      setError(failure.message || '');
      setAsking(false);
    }
  };
  return (
    <li className="saved-manager-row">
      <div className="saved-manager-text">
        <strong>{title}</strong>
        <span>{item.body}</span>
      </div>
      {canChange && !asking && (
        <div className="saved-manager-actions">
          <Button
            variant="light"
            aria-label={t('inboxSaved.manage.editNamed', { title })}
            onClick={onEdit}
          >
            {t('inboxSaved.manage.edit')}
          </Button>
          <Button
            variant="danger-light"
            icon="trash"
            aria-label={t('inboxSaved.manage.removeNamed', { title })}
            title={t('inboxSaved.manage.removeNamed', { title })}
            onClick={() => setAsking(true)}
          />
        </div>
      )}
      {asking && (
        <div
          className="saved-manager-confirm"
          onKeyDown={(event) => {
            // Escape keeps the reply and leaves the dialog open.
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setAsking(false);
          }}
        >
          <span>
            {t('inboxSaved.manage.removeAsk', { title })}
            {company && ` ${t('inboxSaved.manage.removeCompany')}`}
          </span>
          <div>
            <Button variant="light" autoFocus onClick={() => setAsking(false)}>
              {t('inboxSaved.manage.removeKeep')}
            </Button>
            <Button variant="danger-light" disabled={busy} onClick={remove}>
              {t('inboxSaved.manage.removeYes')}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
