import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { usePoll } from '../inbox/usePoll.js';
import { ServerNavigationItem } from '../ServerNavigationItem.jsx';
import { badge } from './chatModel.js';

const NAV_POLL_MS = 15_000;

/** The sidebar's Team chat entry with the unread badge, polled while the page is visible. */
export function TeamChatNavItem({ route, onSelect }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [unread, setUnread] = useState(0);
  const load = useCallback(
    (signal) =>
      api
        .chatSummary(user.workspaceId, signal)
        .then((value) => setUnread(Number(value?.unread) || 0))
        .catch(() => {}),
    [api, user.workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, route]);
  usePoll(load, NAV_POLL_MS, Boolean(user.workspaceId));
  const count = badge(unread);
  return (
    <ServerNavigationItem
      name="Team chat"
      icon="users"
      route={route}
      onSelect={onSelect}
      label={t('chat.title')}
      badge={count}
      badgeLabel={count ? t('chat.nav.unread', { count: unread }) : ''}
    />
  );
}
