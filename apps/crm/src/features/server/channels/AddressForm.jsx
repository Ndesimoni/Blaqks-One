import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { displayNameProblem, localPartProblem, suggestLocalPart } from './addressModel.js';
import { ChannelField, described } from './ChannelField.jsx';

/** Gives one eligible member a sending address on the company domain. */
export function AddressForm({ domain, members, t, busy, onSubmit, onClose }) {
  const id = useId();
  const [memberId, setMemberId] = useState('');
  const [localPart, setLocalPart] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [touched, setTouched] = useState({ local: false, name: false });
  const [error, setError] = useState('');
  const choose = (value) => {
    setError('');
    setMemberId(value);
    const member = members.find((row) => row.id === value);
    if (!touched.local) setLocalPart(suggestLocalPart(member?.name));
    if (!touched.name) setDisplayName(member?.name ?? '');
  };
  const submit = async (event) => {
    event.preventDefault();
    const problem = !memberId
      ? 'emailAddresses.memberRequired'
      : localPartProblem(localPart) || displayNameProblem(displayName);
    setError(problem ? t(problem) : '');
    if (problem) return;
    const failure = await onSubmit({
      memberId,
      localPart: localPart.trim().toLowerCase(),
      displayName: displayName.trim(),
    });
    if (failure) setError(failure);
  };
  return (
    <form
      className="channel-form address-form"
      onSubmit={submit}
      noValidate
      aria-label={t('emailAddresses.addTitle')}
    >
      <ChannelField id={`${id}-member`} label={t('emailAddresses.member')}>
        <select id={`${id}-member`} value={memberId} onChange={(e) => choose(e.target.value)}>
          <option value="">{t('emailAddresses.chooseMember')}</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </ChannelField>
      <ChannelField
        id={`${id}-local`}
        label={t('emailAddresses.localPart')}
        hint={t('emailAddresses.localHint')}
        suffix={`@${domain}`}
        preview={
          localPart.trim() &&
          t('emailAddresses.preview', { address: `${localPart.trim().toLowerCase()}@${domain}` })
        }
      >
        <input
          id={`${id}-local`}
          className="u-ltr"
          value={localPart}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          {...described(`${id}-local`, true)}
          onChange={(event) => {
            setTouched((current) => ({ ...current, local: true }));
            setError('');
            setLocalPart(event.target.value);
          }}
        />
      </ChannelField>
      <ChannelField
        id={`${id}-name`}
        label={t('emailAddresses.displayName')}
        hint={t('emailAddresses.nameHint')}
      >
        <input
          id={`${id}-name`}
          value={displayName}
          maxLength={80}
          autoComplete="off"
          {...described(`${id}-name`, true)}
          onChange={(event) => {
            setTouched((current) => ({ ...current, name: true }));
            setError('');
            setDisplayName(event.target.value);
          }}
        />
      </ChannelField>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="channel-actions">
        <Button type="submit" disabled={busy}>
          {t('emailAddresses.addAction')}
        </Button>
        <Button variant="light" disabled={busy} onClick={onClose}>
          {t('channels.cancel')}
        </Button>
      </div>
    </form>
  );
}
