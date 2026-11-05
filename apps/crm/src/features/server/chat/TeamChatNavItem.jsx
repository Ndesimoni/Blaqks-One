import React from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ServerNavigationItem } from '../ServerNavigationItem.jsx';
import { badge } from './chatModel.js';
import { useChatCounts } from './useChatCounts.js';

/**
 * The sidebar's Team chat entry with its badge, polled while the page is visible: `@count`
 * when colleagues mentioned you (packet C3), otherwise the unread count.
 */
export function TeamChatNavItem({ route, onSelect, active, label: shown }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const { unread, mentions } = useChatCounts(api, user.workspaceId, route);
  const label = [
    unread ? t('chat.nav.unread', { count: unread }) : '',
    mentions ? t('chat.nav.mentions', { count: mentions }) : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <ServerNavigationItem
      name="Team chat"
      icon="users"
      route={route}
      onSelect={onSelect}
      label={shown || t('chat.title')}
      active={active}
      badge={mentions ? `@${badge(mentions)}` : badge(unread)}
      badgeLabel={label}
    />
  );
}
