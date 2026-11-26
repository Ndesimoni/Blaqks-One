import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { activityLabel } from './access.js';
import { TeamChatNavItem } from './chat/TeamChatNavItem.jsx';
import { connectedGroups, navIcons, navLabel } from './connectedNav.js';
import { InboxNavItem } from './inbox/InboxNavItem.jsx';
import { ServerNavigationItem } from './ServerNavigationItem.jsx';
import { waitingSources } from './waitingCounts.js';
import { WaitingNavItem } from './WaitingNavItem.jsx';

export { ServerNavigationItem };

/** One destination: Inbox and Team chat carry their own badge polling. */
function NavEntry({ name, user, route, onSelect, t }) {
  const icon = navIcons[name];
  if (name === 'Inbox') return <InboxNavItem route={route} onSelect={onSelect} />;
  if (name === 'Team chat') return <TeamChatNavItem route={route} onSelect={onSelect} />;
  const label =
    name === 'Website'
      ? t('websites.title')
      : name === 'Platform website'
        ? t('websites.platformTitle')
        : name === 'Team activity'
          ? activityLabel(user)
          : navLabel(user, name);
  if (waitingSources[name])
    return (
      <WaitingNavItem
        name={name}
        icon={icon}
        label={name === 'Agreements' ? t('agreements.title') : label}
        route={route}
        onSelect={onSelect}
      />
    );
  return (
    <ServerNavigationItem name={name} icon={icon} label={label} route={route} onSelect={onSelect} />
  );
}

/** Task-based connected groups; pinned account and administration groups follow the work. */
export function ServerNavigationGroups({ user, route, onSelect }) {
  const { t } = useI18n();
  return connectedGroups(user).map((group) => (
    <div className={'nav-group' + (group.pinned ? ' nav-group-pinned' : '')} key={group.key}>
      <div className="nav-label">{t(`navigation.${group.key}`)}</div>
      {group.items.map((name) => (
        <NavEntry key={name} name={name} user={user} route={route} onSelect={onSelect} t={t} />
      ))}
    </div>
  ));
}
