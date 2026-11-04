import React from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import { useSession } from '../../../../hooks/useSession.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { canOpenSection } from '../../access.js';
import { badge } from '../../chat/chatModel.js';
import { stripItems, stripLabel } from './chatStripModel.js';
import { useRecentChats } from './useRecentChats.js';
import './chat-strip.css';

/**
 * Bitrix24's right panel (NAV5, approved mockup) on wide screens: the messenger, then the
 * person's newest Client inbox conversations and Team chat rooms with what is unread. Each
 * opens that conversation in the messenger panel; narrower screens use the header buttons.
 */
export function ChatStrip({ refreshKey, onOpen }) {
  const { t } = useI18n();
  const { api, user } = useSession();
  const inbox = canOpenSection(user, 'Inbox');
  const team = canOpenSection(user, 'Team chat');
  const data = useRecentChats(api, user.workspaceId, { inbox, team }, refreshKey);
  if (!inbox && !team) return null;
  const items = stripItems(data.rows, data.rooms, data.people, t);
  return (
    <aside className="chat-strip" aria-label={t('messenger.strip')}>
      <button
        type="button"
        className="icon-btn chat-strip-open"
        aria-label={t('messenger.openMessenger')}
        onClick={() => onOpen(inbox ? 'inbox' : 'team')}
      >
        <Icon name="chat" size={20} />
      </button>
      {items.length > 0 && <hr />}
      {items.map((item) => (
        <button
          type="button"
          key={`${item.box}-${item.id}`}
          className={'chat-strip-who' + (item.box === 'team' ? ' is-team' : '')}
          title={item.name}
          aria-label={stripLabel(item, t)}
          onClick={() => onOpen(item.box, item.id)}
        >
          <span aria-hidden="true">{item.initials}</span>
          {item.unread > 0 && (
            <span className="header-badge" aria-hidden="true">
              {badge(item.unread)}
            </span>
          )}
        </button>
      ))}
    </aside>
  );
}
