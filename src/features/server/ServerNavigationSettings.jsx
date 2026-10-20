import React from 'react';
import { activityLabel, canOpenSection } from './access.js';
import { ServerNavigationItem } from './ServerNavigationGroups.jsx';

const settings = [
  ['My profile', 'person'],
  ['Team activity', 'clock'],
  ['Workspaces', 'building'],
  ['Team & access', 'shield'],
  ['Channels', 'chat'],
];

export function ServerNavigationSettings({ user, route, onSelect }) {
  const items = settings.filter(([name]) => canOpenSection(user, name));
  if (!items.length) return null;
  return (
    <div className="nav-group team-settings-nav">
      <div className="nav-label">SETTINGS</div>
      {items.map(([name, icon]) => (
        <ServerNavigationItem
          key={name}
          name={name}
          icon={icon}
          label={name === 'Team activity' ? activityLabel(user) : undefined}
          route={route}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
