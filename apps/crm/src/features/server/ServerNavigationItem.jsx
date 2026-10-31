import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { isConnectedSection } from './sectionStatus.js';

/** One connected sidebar entry; sections not yet connected say so, and a badge may count. */
export function ServerNavigationItem({
  name,
  icon,
  route,
  onSelect,
  label: shown,
  badge,
  badgeLabel,
}) {
  const label = shown || (name === 'Team & access' ? 'Team' : name);
  const connected = isConnectedSection(name);
  return (
    <button
      type="button"
      className={'nav-item connected-nav-item' + (route === name ? ' active' : '')}
      aria-label={badgeLabel ? `${label}, ${badgeLabel}` : label}
      aria-current={route === name ? 'page' : undefined}
      title={connected ? label : `${label} · Not connected yet`}
      onClick={() => onSelect(name)}
    >
      <Icon name={icon} size={18} />
      <span className="connected-nav-label">{label}</span>
      {!connected && <small className="connected-nav-status">Not connected</small>}
      {badge && (
        <span className="connected-nav-badge" aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
}
