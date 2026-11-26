import React, { useEffect } from 'react';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { CompanyPanel } from '../platformCompanies/CompanyPanel.jsx';
import { usePlatformCompanies } from '../platformCompanies/usePlatformCompanies.js';

/**
 * The company panel from Platform → Companies, opened from a usage row. The panel's seat and
 * people controls need the company list's current row (with its version), so it is read
 * when the panel opens; a company that cannot be found closes with a message.
 */
export function UsageCompanyPanel({ id, onClose, onChanged }) {
  const { t } = useI18n();
  const { setToast } = useWorkspaceView();
  const list = usePlatformCompanies();
  const company = list.rows?.find((row) => row.id === id);
  const missing = Boolean(list.error) || (Boolean(list.rows) && !company);
  useEffect(() => {
    if (!missing) return;
    setToast(t('platformMetrics.panelMissing'));
    onClose();
  }, [missing, onClose, setToast, t]);
  if (!company) return null;
  return (
    <CompanyPanel
      company={company}
      onClose={onClose}
      onChanged={() => {
        list.reload();
        onChanged();
      }}
      onToast={setToast}
    />
  );
}
