import React from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useI18n } from '../../i18n/useI18n.js';
import { badge } from './chat/chatModel.js';
import { ServerNavigationItem } from './ServerNavigationItem.jsx';
import { useWaitingCount } from './useWaitingCount.js';
import { waitingSources } from './waitingCounts.js';
import { isPlatformMember } from './platformAccess.js';

/**
 * A sidebar entry with a "waiting for you" badge (agreements design §17), polled like Team
 * chat: on every route change and every 15 seconds while the page is visible. A failed read
 * keeps the last count; the Super Admin, who decides no hand-overs, is never polled.
 */
export function WaitingNavItem({ name, icon, label, route, onSelect, active }) {
  const { user } = useSession();
  const { t } = useI18n();
  const source = waitingSources[name];
  // Company badges for company members; Blaqks One's own (help requests) for its team.
  const count = useWaitingCount(source, Boolean(source.platform) === isPlatformMember(user), route);
  return (
    <ServerNavigationItem
      name={name}
      icon={icon}
      label={label}
      route={route}
      onSelect={onSelect}
      active={active}
      badge={badge(count)}
      badgeLabel={count ? t(source.labelKey, { count }) : ''}
    />
  );
}
