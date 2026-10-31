import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { usePoll } from '../inbox/usePoll.js';
import { ServerNavigationItem } from '../ServerNavigationItem.jsx';
import { badge } from './chatModel.js';

const NAV_POLL_MS = 15_000;

/**
 * The sidebar's Team chat entry with its badge, polled while the page is visible: `@count`
 * when colleagues mentioned you (packet C3), otherwise the unread count.
 */
export function TeamChatNavItem({ route, onSelect }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [counts, setCounts] = useState({ unread: 0, mentions: 0 });
  const load = useCallback(
    (signal) =>
      api
        .chatSummary(user.workspaceId, signal)
        .then((value) =>
          setCounts({ unread: Number(value?.unread) || 0, mentions: Number(value?.mentions) || 0 }),
        )
        .catch(() => {}),
    [api, user.workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, route]);
  usePoll(load, NAV_POLL_MS, Boolean(user.workspaceId));
  const { unread, mentions } = counts;
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
      label={t('chat.title')}
      badge={mentions ? `@${badge(mentions)}` : badge(unread)}
      badgeLabel={label}
    />
  );
}
