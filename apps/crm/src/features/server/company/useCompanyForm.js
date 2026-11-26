import { useRef, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useI18n } from '../../../i18n/useI18n.js';
import {
  companyDraft,
  companyErrors,
  companyFields,
  companyPayload,
  draftChanged,
} from './companyModel.js';

/**
 * The company details draft against the session's company: field errors, Discard, Save with
 * the company version, and the latest details when someone else saved first. A saved company
 * replaces the session's, so the sidebar and Get started follow at once.
 */
export function useCompanyForm() {
  const { t } = useI18n();
  const { api, user, company, replaceCompany } = useSession();
  const [draft, setDraft] = useState(() => companyDraft(company));
  const [version, setVersion] = useState(company.version);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const inputs = useRef({});
  if (version !== company.version) {
    setVersion(company.version);
    setDraft(companyDraft(company));
    setErrors({});
  }
  const changed = draftChanged(draft, company);
  useUnsavedChanges(changed, busy);
  const change = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFailure('');
    setStatus('');
  };
  const discard = () => {
    setDraft(companyDraft(company));
    setErrors({});
    setFailure('');
  };
  const save = async (event) => {
    event?.preventDefault();
    if (busy || !changed) return;
    const found = companyErrors(draft);
    setErrors(found);
    const first = companyFields.find((field) => found[field]);
    if (first) return inputs.current[first]?.focus();
    setBusy(true);
    setFailure('');
    try {
      replaceCompany(await api.updateCompany(user.workspaceId, companyPayload(version, draft)));
      setStatus(t('company.saved'));
    } catch (error) {
      if (!['stale', 'version_conflict'].includes(error.details?.code)) setFailure(error.message);
      else {
        const latest = await api.company(user.workspaceId).catch(() => null);
        if (latest) replaceCompany(latest);
        setFailure(t('company.reloaded'));
      }
    } finally {
      setBusy(false);
    }
  };
  return { draft, errors, failure, status, busy, changed, inputs, change, discard, save };
}
