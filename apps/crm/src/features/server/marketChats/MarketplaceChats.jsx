import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import '../chat/chat.css';
import '../chat/chat-frame.css';
import '../chat/chat-message.css';
import '../chat/chat-mentions.css';
import '../chat/chat-phone.css';
import '../inbox/inbox-rows.css';
import { InlineConfirm } from '../profile/InlineConfirm.jsx';
import { MarketChatGate } from './MarketChatGate.jsx';
import { MarketChatList } from './MarketChatList.jsx';
import { MarketChatSide } from './MarketChatSide.jsx';
import { MarketChatThread } from './MarketChatThread.jsx';
import { useMarketChats } from './useMarketChats.js';
import './market-chats.css';

const JOIN_FIRST = 'Join the marketplace first.';

/**
 * Messages → Marketplace chats as the approved mockup (Team chat's frame): Active and Closed
 * across the top, the broker chats beside the open one and, on wide screens, its request.
 * The address names the open chat (the slide-in messenger's `selection` holds it instead).
 * An unsent message asks before another chat opens. Company Admins never read others' chats.
 */
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
  const selectedId = selection
    ? selection.id
    : new URLSearchParams(location.search).get('chat') || '';
  useUnsavedChanges(!selection && dirty, busy, k('discard'));
  useEffect(() => onDirty?.(dirty), [dirty, onDirty]);
  useEffect(() => onBusy?.(busy), [busy, onBusy]);
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
  const chat = list.rows?.find((row) => row.id === selectedId);
  useEffect(() => {
    if (selectedId && list.rows && !chat && list.nextOffset != null && !list.loadingMore)
      list.loadMore();
  }, [selectedId, chat, list]);
  if (list.status === 409 && list.error === JOIN_FIRST)
    return <MarketChatGate title={k('joinTitle')} detail={k('join')} onOpen={navigate} />;
  if (list.error && !list.rows)
    return <MarketChatGate title={k('unavailable')} detail={list.error} onOpen={navigate} />;
  if (!list.rows) return <p role="status">{k('loading')}</p>;
  if (!list.rows.length) return <MarketChatGate title={k('none')} detail={k('noneHint')} />;
  const tab = (closed) => (
    <button
      type="button"
      role="tab"
      aria-selected={view.closed === closed}
      className={view.closed === closed ? 'is-active' : undefined}
      onClick={() => setView({ ...view, closed })}
    >
      {k(closed ? 'closed' : 'active')}
    </button>
  );
  return (
    <div className="chat-page market-chat-page">
      <div role="tablist" aria-label={k('tabs')} className="chat-top-tabs">
        {tab(false)}
        {tab(true)}
      </div>
      <section
        className={
          'chat-layout' +
          (chat ? ' is-room' : ' is-list') +
          (chat && !selection ? ' has-members' : '')
        }
        aria-label={k('listLabel')}
      >
        <MarketChatList
          rows={list.rows}
          view={view}
          onQuery={(query) => setView({ ...view, query })}
          selectedId={selectedId}
          onOpen={(id) => guarded(() => changeChat(id))}
          more={{ nextOffset: list.nextOffset, loading: list.loadingMore, load: list.loadMore }}
        />
        <section className="chat-room-pane">
          {pending && (
            <InlineConfirm
              label={k('discardLabel')}
              prompt={k('discard')}
              confirmLabel={k('discardConfirm')}
              busy={busy}
              onConfirm={() => {
                const action = pending.run;
                setPending(null);
                action();
              }}
              onCancel={() => setPending(null)}
            />
          )}
          {chat ? (
            <MarketChatThread
              key={chat.id}
              chat={chat}
              onBack={() => guarded(() => changeChat(''))}
              onSent={list.reload}
              onDirty={setDirty}
              onBusy={setBusy}
            />
          ) : (
            <p className="chat-muted chat-choose">{k('pick')}</p>
          )}
        </section>
        {chat && !selection && <MarketChatSide chat={chat} />}
      </section>
    </div>
  );
}
