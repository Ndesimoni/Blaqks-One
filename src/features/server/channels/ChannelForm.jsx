import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { EMAIL_PROVIDERS } from './channelModel.js';

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
  const submit = (event) => {
    event.preventDefault();
    if (connect && (!label.trim() || !account.trim())) {
      setError(t('channels.required'));
      return;
    }
    if (!credential.trim()) {
      setError(t('channels.credentialRequired'));
      return;
    }
    setError('');
    onSubmit(
      connect
        ? {
            channel,
            provider: selected,
            label: label.trim(),
            externalAccountId: account.trim(),
            credential,
          }
        : { expectedVersion: connection.version, credential },
    );
  };
  return (
    <form
      className="channel-form"
      onSubmit={submit}
      aria-label={t(connect ? 'channels.formConnect' : 'channels.formReconnect', {
        channel: channelName,
      })}
    >
      {connect && (
        <>
          <div className="channel-field">
            <label htmlFor={`${id}-label`}>{t('channels.label')}</label>
            <input
              id={`${id}-label`}
              value={label}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="channel-field">
            <label htmlFor={`${id}-account`}>{t('channels.account')}</label>
            <input
              id={`${id}-account`}
              value={account}
              maxLength={160}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setAccount(event.target.value)}
            />
          </div>
          {channel === 'email' && (
            <div className="channel-field">
              <label htmlFor={`${id}-provider`}>{t('channels.provider')}</label>
              <select
                id={`${id}-provider`}
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {EMAIL_PROVIDERS.map((name) => (
                  <option key={name} value={name}>
                    {t(`channels.providerName.${name}`)}
                  </option>
                ))}
              </select>
              <small>{t('channels.providerHint')}</small>
            </div>
          )}
        </>
      )}
      <div className="channel-field">
        <label htmlFor={`${id}-credential`}>{t('channels.credential')}</label>
        <input
          id={`${id}-credential`}
          type="password"
          value={credential}
          maxLength={4096}
          autoComplete="new-password"
          onChange={(event) => setCredential(event.target.value)}
        />
        <small>{t('channels.credentialHint')}</small>
      </div>
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
