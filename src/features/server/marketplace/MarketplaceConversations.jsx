import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMarketActivity } from './useMarketActivity.js';
import { MarketplaceMessageThread } from './MarketplaceMessageThread.jsx';

/** Only the poster and each named broker receive their private conversation. */
export function MarketplaceConversations({
  requestId,
  canMessage,
  paused,
  onChanged,
  onDirty,
  onBusy,
}) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const k = (key, vars) => t(`marketplaceAnswers.${key}`, vars);
  const list = useMarketActivity('marketplaceConversations', requestId);
  const [selected, setSelected] = useState('');
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [threadDirty, setThreadDirty] = useState(false);
  const [threadBusy, setThreadBusy] = useState(false);
  useEffect(() => {
    onDirty?.(Boolean(body.trim()) || threadDirty);
    return () => onDirty?.(false);
  }, [body, threadDirty, onDirty]);
  useEffect(() => {
    onBusy?.(busy || threadBusy);
    return () => onBusy?.(false);
  }, [busy, threadBusy, onBusy]);
  const start = async () => {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const value = await api.startMarketplaceConversation(
        user.workspaceId,
        requestId,
        body.trim(),
      );
      setSelected(value.conversationId);
      setComposing(false);
      setBody('');
      list.reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const conversations = list.value?.conversations || [];
  return (
    <section className="market-conversations" aria-label={k('messages')}>
      <h3>{k('messages')}</h3>
      {list.loading && <p role="status">{k('loading')}</p>}
      {list.error && <p role="alert">{list.error}</p>}
      {!list.loading && !conversations.length && <p>{k('noConversations')}</p>}
      {canMessage && !paused && <p className="market-hint">{k('noMatches')}</p>}
      <div className="market-actions">
        {conversations.map((conversation) => (
          <Button
            key={conversation.id}
            variant="light"
            aria-pressed={selected === conversation.id}
            onClick={() => {
              if (!threadBusy && ((!body.trim() && !threadDirty) || window.confirm(k('discard')))) {
                setBody('');
                setSelected(conversation.id);
              }
            }}
          >
            {k('conversation', { name: conversation.brokerName })}
          </Button>
        ))}
        {canMessage && !paused && !conversations.length && (
          <Button variant="light" onClick={() => setComposing(true)}>
            {k('messagePoster')}
          </Button>
        )}
      </div>
      {composing && canMessage && !paused && (
        <>
          <p className="market-hint">{k('messageHint')}</p>
          <p className="market-hint">{k('messagePrivacy')}</p>
          <label className="field">
            <span>{k('message')}</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={body}
              disabled={busy}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <Button onClick={start} disabled={busy || !body.trim()}>
            {k('send')}
          </Button>
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {selected && (
        <MarketplaceMessageThread
          key={selected}
          conversationId={selected}
          paused={paused}
          onDirty={setThreadDirty}
          onBusy={setThreadBusy}
        />
      )}
    </section>
  );
}
