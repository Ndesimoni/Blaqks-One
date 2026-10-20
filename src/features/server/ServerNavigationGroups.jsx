import React from 'react';
import { nav } from '../../config/navigation.js';
import { canOpenSection } from './access.js';
import { ServerNavigationItem } from './ServerNavigationItem.jsx';
import { InboxNavItem } from './inbox/InboxNavItem.jsx';
import { TeamChatNavItem } from './chat/TeamChatNavItem.jsx';

export { ServerNavigationItem };

export function ServerNavigationGroups({ user, route, onSelect }) {
  return nav.map((group) => {
    // The Messages slot is the Inbox for company members, whatever their reply grants.
    const items = group.items.filter(
      ([name]) =>
        canOpenSection(user, name) || (name === 'Messages' && canOpenSection(user, 'Inbox')),
    );
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
