import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMarketActivity } from './useMarketActivity.js';

/** Plain-text broker conversation. No private CRM records are read or attached here. */
export function MarketplaceMessageThread({
  conversationId,
  participantName,
  paused,
  onSent,
  onDirty,
  onBusy,
}) {
  const { api, user } = useSession();
  const { t, format } = useI18n();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  const thread = useMarketActivity('marketplaceMessages', conversationId);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    onDirty?.(Boolean(body.trim()));
    return () => onDirty?.(false);
  }, [body, onDirty]);
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);
  const send = async () => {
    if (busy || paused || !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.sendMarketplaceMessage(user.workspaceId, conversationId, body.trim());
      setBody('');
      thread.reload();
      onSent?.();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="market-message-thread">
      {thread.loading && <p role="status">{k('loading')}</p>}
      {thread.error && <p role="alert">{thread.error}</p>}
      <ol className="market-message-list" aria-label={k('messages')}>
        {(thread.value?.messages || []).map((message) => (
          <li key={message.id}>
            <strong>
              {message.authorId === user.id ? k('you') : participantName || k('broker')}
            </strong>
            <time dateTime={message.createdAt}>{format.date(message.createdAt)}</time>
            <p>{message.body}</p>
          </li>
        ))}
      </ol>
      <p className="market-hint">{k('messagePrivacy')}</p>
      {paused ? (
        <p role="status">{k('pausedText')}</p>
      ) : (
        <label className="field">
          <span>{k('message')}</span>
          <textarea
            value={body}
            maxLength={2000}
            rows={3}
            onChange={(event) => setBody(event.target.value)}
            disabled={busy}
          />
        </label>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!paused && (
        <Button onClick={send} disabled={busy || !body.trim()}>
          {k('send')}
        </Button>
      )}
      <Button variant="light" onClick={thread.reload} disabled={thread.loading}>
        {k('refresh')}
      </Button>
    </div>
  );
}
