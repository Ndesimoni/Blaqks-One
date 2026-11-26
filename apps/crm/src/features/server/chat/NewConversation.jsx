import React, { useId, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { channelSlug, matchPeople } from './chatModel.js';

/** New channel (the Admin) or a private message to one colleague. */
export function NewConversation({ mode, people, onChannel, onDirect, onCancel }) {
  const { t } = useI18n();
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = useMemo(() => matchPeople(people, value), [people, value]);
  const act = async (action) => {
    setBusy(true);
    const failure = await action();
    setBusy(false);
    setError(failure ? t('chat.failed', { reason: failure }) : '');
  };
  const field = mode === 'channel' ? 'chat.channel.label' : 'chat.direct.search';
  return (
    <div className="chat-new" onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <div className="chat-new-head">
        <strong>{t(mode === 'channel' ? 'chat.newChannel' : 'chat.direct.pick')}</strong>
        <Button variant="light" onClick={onCancel}>
          {t('chat.cancel')}
        </Button>
      </div>
      <label htmlFor={`${id}-field`}>{t(field)}</label>
      <input
        id={`${id}-field`}
        value={value}
        maxLength={mode === 'channel' ? 41 : 80}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
      />
      {mode === 'channel' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) act(() => onChannel(value));
          }}
        >
          <small>
            {t('chat.channel.hint')} {value.trim() && <bdi>#{channelSlug(value)}</bdi>}
          </small>
          <Button type="submit" disabled={busy || !value.trim()}>
            {t('chat.channel.create')}
          </Button>
        </form>
      ) : matches.length === 0 ? (
        <p className="chat-muted">{t('chat.direct.none')}</p>
      ) : (
        <ul className="chat-people">
          {matches.map((person) => (
            <li key={person.id}>
              <button type="button" disabled={busy} onClick={() => act(() => onDirect(person.id))}>
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
