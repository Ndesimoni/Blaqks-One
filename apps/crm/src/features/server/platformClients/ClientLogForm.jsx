import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { LOG_KINDS, clientName } from './clientsModel.js';

/**
 * "Log a call, message or note" above the timeline (Manage): the type (Call first, then
 * WhatsApp, Email, Text message, Note) and what happened. Nothing is sent to the client; the
 * entry is only recorded on its timeline. The text stays if saving fails.
 */
export function ClientLogForm({ client, one }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const id = useId();
  const [kind, setKind] = useState('call');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const busy = one.busy === 'log';
  const submit = async (event) => {
    event.preventDefault();
    setDone('');
    if (!body.trim()) return setError(k('logEmpty'));
    setError('');
    const outcome = await one.log(kind, body.trim());
    if (!outcome.ok) return setError(outcome.message);
    setBody('');
    setDone(k('logged', { name: clientName(client) }));
  };
  return (
    <form className="platform-client-log" aria-label={k('log')} noValidate onSubmit={submit}>
      <p className="platform-client-log-title">{k('log')}</p>
      <div className="platform-client-log-row">
        <div className="field">
          <label htmlFor={`${id}-kind`}>{k('logKind')}</label>
          <select
            id={`${id}-kind`}
            value={kind}
            disabled={busy}
            onChange={(event) => setKind(event.target.value)}
          >
            {LOG_KINDS.map((option) => (
              <option key={option} value={option}>
                {k(`kind.${option}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field platform-client-log-body">
          <label htmlFor={`${id}-body`}>{k('logBody')}</label>
          <textarea
            id={`${id}-body`}
            rows={2}
            maxLength={2000}
            value={body}
            disabled={busy}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="platform-client-log-foot">
        <span className="sr-only" role="status">
          {done}
        </span>
        <Button type="submit" variant="light" icon="plus" disabled={busy}>
          {busy ? k('saving') : k('logSave')}
        </Button>
      </div>
    </form>
  );
}
