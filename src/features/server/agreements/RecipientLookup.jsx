import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';

const reason = (failure) =>
  failure.status === 404 ? 'none' : failure.status === 400 ? 'invalid' : 'failed';

/**
 * Names the agreement's recipient by their exact sign-in email (`POST /agreements/
 * recipients`). The server answers only for an active member of another company, so the
 * person sees who will receive the offer before any terms are written.
 */
export function RecipientLookup({ recipient, onChange, error }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const id = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', reason: '' });
  const find = async () => {
    if (!email.trim()) return setState({ status: 'error', reason: 'required' });
    setState({ status: 'searching', reason: '' });
    try {
      const value = await api.findAgreementRecipient(user.workspaceId, email.trim());
      setState({ status: 'idle', reason: '' });
      onChange(value.recipient);
    } catch (failure) {
      setState({ status: 'error', reason: reason(failure) });
    }
  };
  if (recipient)
    return (
      <div className="agreement-recipient" role="status">
        <Icon name="person" size={20} />
        <div>
          <strong>{recipient.name}</strong>
          <small>{recipient.company || t('agreements.party.otherCompany')}</small>
        </div>
        <Button variant="light" onClick={() => onChange(null)}>
          {t('agreementForm.lookup.change')}
        </Button>
      </div>
    );
  const message = state.status === 'error' ? t(`agreementForm.lookup.${state.reason}`) : '';
  const shown = message || (error ? t('agreementForm.error.recipient') : '');
  return (
    <div className="field span-all agreement-lookup">
      <label htmlFor={id}>
        {t('agreementForm.lookup.label')}
        <span className="required"> *</span>
      </label>
      <div className="agreement-lookup-row">
        <input
          id={id}
          type="email"
          autoComplete="off"
          value={email}
          aria-invalid={Boolean(shown)}
          aria-describedby={`${id}-hint${shown ? ` ${id}-error` : ''}`}
          onChange={(event) => {
            setEmail(event.target.value);
            setState({ status: 'idle', reason: '' });
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            find();
          }}
        />
        <Button
          variant="light"
          icon="search"
          disabled={state.status === 'searching'}
          onClick={find}
        >
          {state.status === 'searching'
            ? t('agreementForm.lookup.searching')
            : t('agreementForm.lookup.find')}
        </Button>
      </div>
      <small id={`${id}-hint`} className="finance-hint">
        {t('agreementForm.lookup.hint')}
      </small>
      {shown && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {shown}
        </p>
      )}
    </div>
  );
}
