import React from 'react';
import { nav } from '../../config/navigation.js';
import { useI18n } from '../../i18n/useI18n.js';
import { canOpenSection } from './access.js';
import { TeamChatNavItem } from './chat/TeamChatNavItem.jsx';
import { InboxNavItem } from './inbox/InboxNavItem.jsx';
import { ServerNavigationItem } from './ServerNavigationItem.jsx';
import { waitingSources } from './waitingCounts.js';
import { WaitingNavItem } from './WaitingNavItem.jsx';

export { ServerNavigationItem };

/** Connected-only Agreements and Marketplace sit after Deals, for company members. */
function withConnectedSections(group, items, user) {
  if (group.header !== 'SALES & RELATIONSHIPS') return items;
  const added = [...items];
  const place = (after, item) => {
    const at = added.findIndex(([name]) => name === after) + 1 || added.length;
    added.splice(at, 0, item);
  };
  if (canOpenSection(user, 'Agreements')) place('Deals', ['Agreements', 'note']);
  if (canOpenSection(user, 'Marketplace')) place('Agreements', ['Marketplace', 'layers']);
  return added;
}

export function ServerNavigationGroups({ user, route, onSelect }) {
  const { t } = useI18n();
  return nav.map((group) => {
    // The Messages slot is the Inbox for company members, whatever their reply grants.
    const allowed = group.items.filter(
      ([name]) =>
        canOpenSection(user, name) || (name === 'Messages' && canOpenSection(user, 'Inbox')),
    );
    const items = withConnectedSections(group, allowed, user);
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
