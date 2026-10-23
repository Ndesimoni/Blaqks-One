import React from 'react';
import { nav } from '../../config/navigation.js';
import { useI18n } from '../../i18n/useI18n.js';
import { canOpenSection } from './access.js';
import { ServerNavigationItem } from './ServerNavigationItem.jsx';
import { InboxNavItem } from './inbox/InboxNavItem.jsx';
import { TeamChatNavItem } from './chat/TeamChatNavItem.jsx';
import { WaitingNavItem } from './WaitingNavItem.jsx';
import { waitingSources } from './waitingCounts.js';

export { ServerNavigationItem };

/** Connected-only Agreements sit after Deals, for every company member (agreements §13). */
function withAgreements(group, items, user) {
  if (group.header !== 'SALES & RELATIONSHIPS' || !canOpenSection(user, 'Agreements')) return items;
  const at = items.findIndex(([name]) => name === 'Deals') + 1 || items.length;
  return [...items.slice(0, at), ['Agreements', 'note'], ...items.slice(at)];
}

export function ServerNavigationGroups({ user, route, onSelect }) {
  const { t } = useI18n();
  return nav.map((group) => {
    // The Messages slot is the Inbox for company members, whatever their reply grants.
    const allowed = group.items.filter(
      ([name]) =>
        canOpenSection(user, name) || (name === 'Messages' && canOpenSection(user, 'Inbox')),
    );
    const items = withAgreements(group, allowed, user);
    if (!items.length) return null;
    return (
      <div className="nav-group" key={group.header}>
        <div className="nav-label">{group.header}</div>
        {items.map(([name, icon]) =>
          // Company members get the Inbox where the demo shows its Messages preview; the
          // Super Admin, who never reads company conversations, keeps the preview entry.
          name === 'Messages' && canOpenSection(user, 'Inbox') ? (
            <React.Fragment key="Inbox">
              <InboxNavItem route={route} onSelect={onSelect} />
              {canOpenSection(user, 'Team chat') && (
                <TeamChatNavItem route={route} onSelect={onSelect} />
              )}
            </React.Fragment>
          ) : waitingSources[name] ? (
            // Deals, Agreements and the shared record pages count what waits for the
            // caller's answer (agreements §17, record sharing R1).
            <WaitingNavItem
              key={name}
              name={name}
              icon={icon}
              label={name === 'Agreements' ? t('agreements.title') : undefined}
              route={route}
              onSelect={onSelect}
            />
          ) : (
            <ServerNavigationItem
              key={name}
              name={name}
              icon={icon}
              route={route}
              onSelect={onSelect}
            />
          ),
        )}
      </div>
    );
  });
}
