import React from 'react';
import { nav } from '../../config/navigation.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { canOpenSection } from './access.js';
import { isConnectedSection } from './sectionStatus.js';

export function ServerNavigationItem({ name, icon, route, onSelect }) {
  const label = name === 'Team & access' ? 'Team' : name;
  const connected = isConnectedSection(name);
  return (
    <button
      type="button"
      className={'nav-item connected-nav-item' + (route === name ? ' active' : '')}
      aria-label={label}
      aria-current={route === name ? 'page' : undefined}
      title={connected ? label : `${label} · Not connected yet`}
      onClick={() => onSelect(name)}
    >
      <Icon name={icon} size={18} />
      <span className="connected-nav-label">{label}</span>
      {!connected && <small className="connected-nav-status">Not connected</small>}
    </button>
  );
}

export function ServerNavigationGroups({ user, route, onSelect }) {
  return nav.map((group) => {
    const items = group.items.filter(([name]) => canOpenSection(user, name));
    if (!items.length) return null;
    return (
      <div className="nav-group" key={group.header}>
        <div className="nav-label">{group.header}</div>
        {items.map(([name, icon]) => (
          <ServerNavigationItem
            key={name}
            name={name}
            icon={icon}
            route={route}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  });
}
