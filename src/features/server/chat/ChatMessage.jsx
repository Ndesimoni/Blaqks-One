import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MessageFiles } from './MessageFiles.jsx';

/**
 * One chat message. The author may edit or delete it; the Admin may delete others'
 * messages in a channel (never in a private conversation). Deleted messages keep their
 * place without their text.
 */
export function ChatMessage({ message, author, mine, canRemove, onEdit, onRemove, urlOf }) {
  const { t, format } = useI18n();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message.body);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const act = async (action) => {
    const failure = await action();
    setError(failure ? t('chat.failed', { reason: failure }) : '');
    return !failure;
  };
  const save = async (event) => {
    event.preventDefault();
    if (text.trim() && (await act(() => onEdit(message.id, text.trim())))) setEditing(false);
  };
  return (
    <li className={'chat-message' + (mine ? ' is-mine' : '')}>
      <div className="chat-message-head">
        <strong>{mine ? t('chat.you') : author}</strong>
        <time dateTime={message.at}>{format.time(message.at)}</time>
        {message.edited && !message.deleted && <span>· {t('chat.edited')}</span>}
      </div>
      {message.deleted ? (
        <p className="chat-deleted">{t('chat.deleted')}</p>
      ) : editing ? (
        <form className="chat-edit" onSubmit={save}>
          <textarea
            aria-label={t('chat.edit')}
            value={text}
            maxLength={4000}
            onChange={(event) => setText(event.target.value)}
          />
          <div>
            <Button type="submit">{t('chat.save')}</Button>
            <Button variant="light" onClick={() => setEditing(false)}>
              {t('chat.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {message.body && <p className="chat-body">{message.body}</p>}
          <MessageFiles files={message.attachments} urlOf={urlOf} />
        </>
      )}
      {!message.deleted && !editing && (mine || canRemove) && (
        <div className="chat-actions" role="group" aria-label={t('chat.actions')}>
          {confirm ? (
            <>
              <span>{t('chat.delete.confirm')}</span>
              <Button variant="danger-light" onClick={() => act(() => onRemove(message.id))}>
                {t('chat.delete')}
              </Button>
              <Button variant="light" onClick={() => setConfirm(false)}>
                {t('chat.cancel')}
              </Button>
            </>
          ) : (
            <>
              {mine && (
                <button type="button" onClick={() => setEditing(true)}>
                  {t('chat.edit')}
                </button>
              )}
              <button type="button" onClick={() => setConfirm(true)}>
                {t('chat.delete')}
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
