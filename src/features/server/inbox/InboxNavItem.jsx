import React from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ServerNavigationItem } from '../ServerNavigationItem.jsx';
import { useInboxSummary } from './useInboxSummary.js';

const NAV_POLL_MS = 30_000;

/** The sidebar's Inbox entry with the unread badge, polled while the page is visible. */
export function InboxNavItem({ route, onSelect }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const { unread } = useInboxSummary(api, user.workspaceId, NAV_POLL_MS);
  const badge = unread > 0 ? (unread > 99 ? '99+' : String(unread)) : '';
  return (
    <ServerNavigationItem
      name="Inbox"
      icon="chat"
      route={route}
      onSelect={onSelect}
      label={t('inbox.title')}
      badge={badge}
      badgeLabel={badge ? t('inbox.nav.unread', { count: unread }) : ''}
    />
  );
}
