import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { InlineConfirm } from '../profile/InlineConfirm.jsx';
import { MarketplaceMessageThread } from '../marketplace/MarketplaceMessageThread.jsx';
import '../marketplace/marketplace-answers.css';
import { MarketChatList } from './MarketChatList.jsx';
import { useMarketChats } from './useMarketChats.js';
import './market-chats.css';

const JOIN_FIRST = 'Join the marketplace first.';

/** Messages → Marketplace chats: private broker conversations, Active and Closed. */
export function MarketplaceChats({ selection = null, onDirty, onBusy }) {
  const { t } = useI18n();
  const k = (key) => t(`marketChats.${key}`);
  const { navigate } = useNavigation();
  const location = useLocation();
  const go = useNavigate();
  const list = useMarketChats();
  const [view, setView] = useState({ closed: false, query: '' });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const params = new URLSearchParams(location.search);
  const selectedId = selection ? selection.id : params.get('chat') || '';
  useUnsavedChanges(!selection && dirty, busy, k('discard'));
  useEffect(() => onDirty?.(dirty), [dirty, onDirty]);
  useEffect(() => onBusy?.(busy), [busy, onBusy]);
  useEffect(() => () => onDirty?.(false), [onDirty]);
  useEffect(() => () => onBusy?.(false), [onBusy]);
  const changeChat = (id) => {
    if (selection) return selection.open(id);
    const next = new URLSearchParams(location.search);
    if (id) next.set('chat', id);
    else next.delete('chat');
    go({ pathname: location.pathname, search: next.size ? `?${next}` : '' });
  };
  const guarded = (action) => {
    if (busy) return;
    if (dirty) setPending({ run: action });
    else action();
  };
  const confirmDiscard = () => {
    const action = pending?.run;
    setPending(null);
    action?.();
  };
  const chat = list.rows?.find((row) => row.id === selectedId);
  useEffect(() => {
    if (selectedId && list.rows && !chat && list.nextOffset != null && !list.loadingMore)
      list.loadMore();
  }, [selectedId, chat, list.rows, list.nextOffset, list.loadingMore, list.loadMore]);
  if (list.status === 409 && list.error === JOIN_FIRST)
    return <MarketChatGate title={k('joinTitle')} detail={k('join')} onOpen={navigate} />;
  if (list.error && !list.rows)
    return <MarketChatGate title={k('unavailable')} detail={list.error} onOpen={navigate} />;
  if (!list.rows) return <p role="status">{k('loading')}</p>;
  if (!list.rows.length)
    return (
      <section className="panel">
        <Empty icon="chat" title={k('none')} detail={k('noneHint')} />
      </section>
    );
  return (
    <div className={'market-chats' + (chat ? ' has-open' : '')}>
      {list.error && (
        <p className="field-error market-chat-error" role="alert">
          {list.error}
        </p>
      )}
      <MarketChatList
        rows={list.rows}
        view={view}
        onView={setView}
        selectedId={selectedId}
        onOpen={(id) => guarded(() => changeChat(id))}
        nextOffset={list.nextOffset}
        loadingMore={list.loadingMore}
        onMore={list.loadMore}
      />
      <section className="panel market-chat-thread" aria-label={chat?.participantName || k('pick')}>
        {pending && (
          <InlineConfirm
            label={k('discardLabel')}
            prompt={k('discard')}
            confirmLabel={k('discardConfirm')}
            busy={busy}
            onConfirm={confirmDiscard}
            onCancel={() => setPending(null)}
          />
        )}
        {chat ? (
          <>
            <button
              type="button"
              className="market-chat-back"
              disabled={busy}
              onClick={() => guarded(() => changeChat(''))}
            >
              {k('back')}
            </button>
            <MarketplaceMessageThread
              key={chat.id}
              conversationId={chat.id}
              participantName={chat.participantName}
              paused={!chat.canReply}
              onSent={list.reload}
              onDirty={setDirty}
              onBusy={setBusy}
            />
          </>
        ) : (
          <p className="market-chat-empty">{k('pick')}</p>
        )}
      </section>
    </div>
  );
}

function MarketChatGate({ title, detail, onOpen }) {
  const { t } = useI18n();
  return (
    <section className="panel">
      <Empty
        icon="layers"
        title={title}
        detail={detail}
        action={
          <Button onClick={() => onOpen('Marketplace')}>{t('marketChats.openMarketplace')}</Button>
        }
      />
    </section>
  );
}
