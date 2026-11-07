import React, { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { ChannelField, described } from './ChannelField.jsx';
import { TokenField } from './TokenField.jsx';
import { TWILIO_FIELDS, twilioBody, twilioProblems } from './whatsappModel.js';

/**
 * Connect the company's Twilio account (Account SID and Auth Token), or reconnect it with a
 * new token. Shapes are checked here first; Twilio proves the account on the server, whose
 * message is shown as sent. Nothing typed is kept after the form closes.
 */
export function TwilioForm({ mode, connection, t, busy, onSubmit, onClose }) {
  const id = useId();
  const connect = mode === 'connect';
  const [values, setValues] = useState({
    label: connect ? t('whatsappAccount.defaultLabel') : '',
    sid: '',
    token: '',
  });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const refs = { label: useRef(null), sid: useRef(null), token: useRef(null) };
  const k = (key) => t(`whatsappAccount.${key}`);
  const error = (key) => (errors[key] ? t(errors[key]) : '');
  const change = (key) => (event) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setFailure('');
  };
  const submit = async (event) => {
    event.preventDefault();
    const problems = twilioProblems(values, connect);
    setErrors(problems);
    setFailure('');
    const first = TWILIO_FIELDS.find((key) => problems[key]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    const message = await onSubmit(twilioBody(values, connect ? null : connection));
    if (message) setFailure(message);
  };
  return (
    <form
      className="channel-form"
      onSubmit={submit}
      noValidate
      aria-label={t(connect ? 'channels.formConnect' : 'channels.formReconnect', {
        channel: t('channels.channel.whatsapp'),
      })}
    >
      {connect && (
        <div className="channel-setup">
          <p>{k('where')}</p>
          <span>{k('log')}</span>
        </div>
      )}
      {connect && (
        <>
          <ChannelField id={`${id}-label`} label={t('channels.label')} error={error('label')}>
            <input
              id={`${id}-label`}
              ref={refs.label}
              value={values.label}
              maxLength={80}
              autoComplete="off"
              {...described(`${id}-label`, '', errors.label)}
              onChange={change('label')}
            />
          </ChannelField>
          <ChannelField id={`${id}-sid`} label={k('sid')} hint={k('sidHint')} error={error('sid')}>
            <input
              id={`${id}-sid`}
              ref={refs.sid}
              className="u-ltr"
              value={values.sid}
              maxLength={64}
              placeholder="AC…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              {...described(`${id}-sid`, true, errors.sid)}
              onChange={change('sid')}
            />
          </ChannelField>
        </>
      )}
      <TokenField
        id={`${id}-token`}
        label={k(connect ? 'token' : 'newToken')}
        hint={connect ? k('tokenHint') : k('reconnectHint')}
        error={error('token')}
        value={values.token}
        inputRef={refs.token}
        labels={{ show: k('show'), hide: k('hide') }}
        onChange={change('token')}
      />
      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}
      <div className="channel-actions">
        <Button type="submit" disabled={busy}>
          {k(connect ? 'connectAction' : 'reconnectAction')}
        </Button>
        <Button variant="light" disabled={busy} onClick={onClose}>
          {t('channels.cancel')}
        </Button>
      </div>
    </form>
  );
}
