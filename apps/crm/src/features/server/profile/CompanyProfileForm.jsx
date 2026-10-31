import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { EMIRATES } from '../../signup/signupModel.js';
import { companyDraft, companyDraftError, companyDraftPayload } from './companyProfileModel.js';

const EMIRATE_KEYS = {
  'abu-dhabi': 'AbuDhabi',
  dubai: 'Dubai',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  'umm-al-quwain': 'UmmAlQuwain',
  'ras-al-khaimah': 'RasAlKhaimah',
  fujairah: 'Fujairah',
};

export function CompanyProfileForm({ api, workspaceId, company, onSaved }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => companyDraft(company));
  const [version, setVersion] = useState(company.version);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const emirateRef = useRef(null);
  useEffect(() => {
    if (company.version === version) return;
    setDraft(companyDraft(company));
    setVersion(company.version);
    setError(null);
  }, [company, version]);
  useEffect(() => {
    if (error?.field === 'displayName') nameRef.current?.focus();
    if (error?.field === 'emirate') emirateRef.current?.focus();
  }, [error]);
  const change = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError((current) => (current?.field === field ? null : current));
  };
  const submit = async (event) => {
    event.preventDefault();
    const invalid = companyDraftError(draft);
    if (invalid) return setError({ field: invalid[0], key: invalid[1] });
    setBusy(true);
    setError(null);
    try {
      const saved = await api.updateCompany(
        workspaceId,
        companyDraftPayload({ ...company, version }, draft),
      );
      setDraft(companyDraft(saved));
      setVersion(saved.version);
      onSaved(saved);
    } catch (failure) {
      if (['stale', 'version_conflict'].includes(failure.details?.code)) {
        try {
          const latest = await api.company(workspaceId);
          setVersion(latest.version);
          onSaved(latest);
          setError({ key: 'signupSetup.companyReloaded' });
        } catch (reloadFailure) {
          setError({ message: reloadFailure.message });
        }
      } else setError({ message: failure.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="panel acct-card company-profile-form" onSubmit={submit}>
      <div className="acct-card-body">
        <div className="field">
          <label htmlFor="company-display-name">{t('signupSetup.companyName')}</label>
          <input
            ref={nameRef}
            id="company-display-name"
            value={draft.displayName}
            disabled={busy}
            onChange={(event) => change('displayName', event.target.value)}
          />
          {error?.field === 'displayName' && <p className="field-error">{t(error.key)}</p>}
        </div>
        <div className="field">
          <label htmlFor="company-emirate">{t('signupSetup.emirate')}</label>
          <select
            ref={emirateRef}
            id="company-emirate"
            value={draft.emirate}
            disabled={busy}
            onChange={(event) => change('emirate', event.target.value)}
          >
            <option value="">{t('signupSetup.emiratePlaceholder')}</option>
            {EMIRATES.map((value) => (
              <option key={value} value={value}>
                {t(`signupSetup.emirate${EMIRATE_KEYS[value]}`)}
              </option>
            ))}
          </select>
          {error?.field === 'emirate' && <p className="field-error">{t(error.key)}</p>}
        </div>
        {!error?.field && error && (
          <p className="field-error" role="alert">
            {error.key ? t(error.key) : error.message}
          </p>
        )}
      </div>
      <div className="acct-card-foot">
        <Button type="submit" disabled={busy}>
          {t(busy ? 'signupSetup.companySaving' : 'signupSetup.companySave')}
        </Button>
      </div>
    </form>
  );
}
