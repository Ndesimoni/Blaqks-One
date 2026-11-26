import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { ChannelField, described } from './ChannelField.jsx';
import { EMAIL_PROVIDERS, fieldKeys, validDomain } from './channelModel.js';
import { SendgridSetup } from './SendgridSetup.jsx';

/** Connect or reconnect a channel. Credentials are write-only and never prefilled. */
export function ChannelForm({ mode, channel, provider, connection, t, busy, onSubmit, onClose }) {
  const id = useId();
  const connect = mode === 'connect';
  const [label, setLabel] = useState(connection?.label ?? '');
  const [account, setAccount] = useState('');
  const [selected, setSelected] = useState(connection?.provider ?? provider ?? EMAIL_PROVIDERS[0]);
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const channelName = t(`channels.channel.${channel}`);
  const keys = fieldKeys(selected);
  const sendgrid = selected === 'sendgrid';
  const check = () => {
    if (connect && (!label.trim() || !account.trim())) return t('channels.required');
    if (connect && sendgrid && !validDomain(account)) return t('channels.sendgrid.domainInvalid');
    if (!credential.trim()) return t('channels.credentialRequired');
    return '';
  };
  const submit = (event) => {
    event.preventDefault();
    const problem = check();
    setError(problem);
    if (problem) return;
    onSubmit(
      connect
        ? {
            channel,
            provider: selected,
            label: label.trim(),
            externalAccountId: sendgrid ? account.trim().toLowerCase() : account.trim(),
            credential,
          }
        : { expectedVersion: connection.version, credential },
    );
  };
  const hint = (key) => (key ? t(key) : '');
  return (
    <form
      className="channel-form"
      onSubmit={submit}
      noValidate
      aria-label={t(connect ? 'channels.formConnect' : 'channels.formReconnect', {
        channel: channelName,
      })}
    >
      {connect && channel === 'email' && (
        <ChannelField
          id={`${id}-provider`}
          label={t('channels.provider')}
          hint={t('channels.sendgrid.providerHint')}
        >
          <select
            id={`${id}-provider`}
            value={selected}
            aria-describedby={`${id}-provider-hint`}
            onChange={(event) => setSelected(event.target.value)}
          >
            {EMAIL_PROVIDERS.map((name) => (
              <option key={name} value={name}>
                {t(`channels.providerOption.${name}`)}
              </option>
            ))}
          </select>
        </ChannelField>
      )}
      {sendgrid && connect && <SendgridSetup t={t} />}
      {connect && (
        <>
          <ChannelField id={`${id}-label`} label={t('channels.label')}>
            <input
              id={`${id}-label`}
              value={label}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setLabel(event.target.value)}
            />
          </ChannelField>
          <ChannelField id={`${id}-account`} label={t(keys.account)} hint={hint(keys.accountHint)}>
            <input
              id={`${id}-account`}
              className="u-ltr"
              value={account}
              maxLength={160}
              autoComplete="off"
              spellCheck={false}
              {...described(`${id}-account`, keys.accountHint)}
              onChange={(event) => setAccount(event.target.value)}
            />
          </ChannelField>
        </>
      )}
      <ChannelField
        id={`${id}-credential`}
        label={t(keys.credential)}
        hint={t(keys.credentialHint)}
      >
        <input
          id={`${id}-credential`}
          type="password"
          value={credential}
          maxLength={4096}
          autoComplete="new-password"
          {...described(`${id}-credential`, keys.credentialHint)}
          onChange={(event) => setCredential(event.target.value)}
        />
      </ChannelField>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="channel-actions">
        <Button type="submit" disabled={busy}>
          {t(connect ? 'channels.connectAction' : 'channels.reconnectAction')}
        </Button>
        <Button variant="light" disabled={busy} onClick={onClose}>
          {t('channels.cancel')}
        </Button>
      </div>
    </form>
  );
}
