import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';

/** Company-style actions kept outside the settings card while submitting its named form. */
export function FinanceSettingsSaveBar({ form, formId, busy }) {
  const { t } = useI18n();
  return (
    <div className="panel team-finance-save-bar">
      <div className="team-finance-save-status" role="status">
        {form.saved || (form.dirty ? t('teamFinance.unsaved') : t('teamFinance.savedState'))}
      </div>
      <div className="team-finance-actions">
        {form.failure.conflict && (
          <Button variant="light" disabled={busy} onClick={form.loadLatest}>
            {t('teamFinance.loadLatest')}
          </Button>
        )}
        <Button variant="light" disabled={busy || !form.dirty} onClick={form.discard}>
          {t('teamFinance.cancel')}
        </Button>
        <Button type="submit" form={formId} disabled={busy || !form.dirty} aria-busy={busy}>
          {busy ? t('teamFinance.saving') : t('teamFinance.save')}
        </Button>
      </div>
    </div>
  );
}
