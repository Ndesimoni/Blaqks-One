import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { RoomList } from './RoomList.jsx';
import { RoomView } from './RoomView.jsx';
import { useChat } from './useChat.js';
import './chat.css';
import './chat-message.css';
import './chat-phone.css';

/**
 * Team chat (packet C2): channels and private messages on the left, the open room on the
 * right; one pane at a time on a phone. The open room lives in the URL (`?room=`).
 */
export function ServerTeamChat() {
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { t } = useI18n();
  const location = useLocation();
  const go = useNavigate();
  const chat = useChat(api, owner.id);
  const selectedId = new URLSearchParams(location.search).get('room') || '';
  const open = useCallback(
    (id) =>
      go({ pathname: location.pathname, search: id ? `?room=${encodeURIComponent(id)}` : '' }),
    [go, location.pathname],
  );
  const room = chat.rooms.find((item) => item.id === selectedId);
  if (chat.status === 'loading') return <p role="status">{t('chat.loading')}</p>;
  if (chat.status === 'error')
    return (
      <section className="panel recovery-panel">
        <p className="field-error" role="alert">
          {t('chat.loadFailed')}
        </p>
        <Button onClick={() => chat.refresh()}>{t('chat.retry')}</Button>
      </section>
    );
  return (
    <div className="chat-page">
      <h1 className="sr-only">{t('chat.title')}</h1>
      <section
        className={'chat-layout' + (room ? ' is-room' : ' is-list')}
        aria-label={t('chat.title')}
      >
        <RoomList chat={chat} selectedId={selectedId} onOpen={open} />
        <section className="chat-room-pane" aria-label={room ? undefined : t('chat.title')}>
          {room ? (
            <RoomView
              key={room.id}
              api={api}
              workspaceId={owner.id}
              room={room}
              people={chat.people}
              user={user}
              onBack={() => open('')}
              onRead={() => chat.refresh()}
            />
          ) : (
            <p className="chat-muted chat-choose">{t('chat.choose')}</p>
          )}
        </section>
      </section>
    </div>
  );
}
