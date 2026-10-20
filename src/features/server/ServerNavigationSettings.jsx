import React from 'react';
import { activityLabel, canOpenSection } from './access.js';
import { ServerNavigationItem } from './ServerNavigationItem.jsx';
import { useI18n } from '../../i18n/useI18n.js';

const settings = [
  ['My profile', 'person'],
  ['My mailbox', 'note'],
  ['Team activity', 'clock'],
  ['Workspaces', 'building'],
  ['Team & access', 'shield'],
  ['Channels', 'chat'],
  ['Inbox rules', 'sliders'],
];

const translated = { 'Inbox rules': 'inboxRules', 'My mailbox': 'mailbox' };

export function ServerNavigationSettings({ user, route, onSelect }) {
  const { t } = useI18n();
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
          label={
            name === 'Team activity'
              ? activityLabel(user)
              : translated[name]
                ? t(`${translated[name]}.title`)
                : undefined
          }
          route={route}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
