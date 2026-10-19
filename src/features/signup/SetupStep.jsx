import React, { useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { EMIRATES } from './signupModel.js';
import { SignupField } from './SignupField.jsx';

const EMIRATE_KEYS = {
  'abu-dhabi': 'AbuDhabi',
  dubai: 'Dubai',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  'umm-al-quwain': 'UmmAlQuwain',
  'ras-al-khaimah': 'RasAlKhaimah',
  fujairah: 'Fujairah',
};

export function SetupStep({ values, error, busy, onChange, onSave }) {
  const { t } = useI18n();
  const name = useRef(null);
  const emirate = useRef(null);
  useEffect(() => {
    if (error?.field === 'displayName') name.current?.focus();
    if (error?.field === 'emirate') emirate.current?.focus();
  }, [error]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <p>{t('signupSetup.brokerageBody')}</p>
      <p className="signup-hint">{t('signupSetup.freeSeats')}</p>
      <SignupField
        id="signup-display-name"
        label={t('signupSetup.companyName')}
        error={error?.field === 'displayName' ? t(error.key) : ''}
      >
        <input
          ref={name}
          value={values.displayName}
          disabled={busy}
          onChange={(event) => onChange('displayName', event.target.value)}
        />
      </SignupField>
      <SignupField
        id="signup-emirate"
        label={t('signupSetup.emirate')}
        error={error?.field === 'emirate' ? t(error.key) : ''}
      >
        <select
          ref={emirate}
          value={values.emirate}
          disabled={busy}
          onChange={(event) => onChange('emirate', event.target.value)}
        >
          <option value="">{t('signupSetup.emiratePlaceholder')}</option>
          {EMIRATES.map((value) => (
            <option key={value} value={value}>
              {t(`signupSetup.emirate${EMIRATE_KEYS[value]}`)}
            </option>
          ))}
        </select>
      </SignupField>
      {!error?.field && error && (
        <p className="field-error" role="alert">
          {t(error.key)}
        </p>
      )}
      <p className="signup-hint">{t('signupSetup.licenceHint')}</p>
      <Button className="signup-primary" type="submit" disabled={busy}>
        {t(busy ? 'signupSetup.finishing' : 'signupSetup.finish')}
      </Button>
    </form>
  );
}
