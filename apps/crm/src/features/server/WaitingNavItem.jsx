import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useI18n } from '../../i18n/useI18n.js';
import { usePoll } from './inbox/usePoll.js';
import { badge } from './chat/chatModel.js';
import { ServerNavigationItem } from './ServerNavigationItem.jsx';
import { waitingSources } from './waitingCounts.js';

const NAV_POLL_MS = 15_000;

/**
 * A sidebar entry with a "waiting for you" badge (agreements design §17), polled like Team
 * chat: on every route change and every 15 seconds while the page is visible. A failed read
 * keeps the last count; the Super Admin, who decides no hand-overs, is never polled.
 */
export function WaitingNavItem({ name, icon, label, route, onSelect }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const source = waitingSources[name];
  const enabled = Boolean(source && user?.workspaceId && user.roleId !== 'super-admin');
  const [count, setCount] = useState(0);
  const load = useCallback(
    (signal) =>
      enabled
        ? source
            .read(api, user.workspaceId, signal)
            .then(setCount)
            .catch(() => {})
        : Promise.resolve(),
    [api, enabled, source, user?.workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, route]);
  useEffect(() => {
    if (!enabled || !source.event) return undefined;
    const refresh = () => load();
    window.addEventListener(source.event, refresh);
    return () => window.removeEventListener(source.event, refresh);
  }, [enabled, load, source]);
  usePoll(load, NAV_POLL_MS, enabled);
  return (
    <ServerNavigationItem
      name={name}
      icon={icon}
      label={label}
      route={route}
      onSelect={onSelect}
      badge={badge(count)}
      badgeLabel={count ? t(source.labelKey, { count }) : ''}
    />
  );
}
