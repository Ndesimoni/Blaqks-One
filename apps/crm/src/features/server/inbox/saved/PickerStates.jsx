import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';

/** The picker's loading, failed, empty and no-match states (designer spec §2). */
export function PickerStates({ saved, none, query, matches, onClear, onAdd }) {
  const { t } = useI18n();
  return (
    <>
      {saved.loading && !saved.data && (
        <p className="saved-picker-state" role="status">
          {t('inboxSaved.picker.loading')}
        </p>
      )}
      {saved.error && (
        <div className="saved-picker-state" role="alert">
          <p>{t('inboxSaved.picker.failed')}</p>
          <Button variant="light" onClick={saved.load}>
            {t('inboxSaved.picker.retry')}
          </Button>
        </div>
      )}
      {none && (
        <div className="saved-picker-state">
          <strong>{t('inboxSaved.picker.empty')}</strong>
          <p>
            {t(`inboxSaved.picker.${saved.data.canManageCompany ? 'emptyAdmin' : 'emptyMember'}`)}
          </p>
          <Button variant="light" icon="plus" onClick={onAdd}>
            {t('inboxSaved.picker.add')}
          </Button>
        </div>
      )}
      {saved.data && !none && !matches && (
        <div className="saved-picker-state" role="status">
          <p>{t('inboxSaved.picker.noMatch', { query: query.trim() })}</p>
          <Button variant="light" onClick={onClear}>
            {t('inboxSaved.picker.clear')}
          </Button>
        </div>
      )}
    </>
  );
}
