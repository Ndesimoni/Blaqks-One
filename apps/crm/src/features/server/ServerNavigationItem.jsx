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
  active: activeOverride,
}) {
  const label = shown || (name === 'Team & access' ? 'Team' : name);
  const connected = isConnectedSection(name);
  const active = activeOverride ?? route === name;
  return (
    <button
      type="button"
      className={'nav-item connected-nav-item' + (active ? ' active' : '')}
      aria-label={badgeLabel ? `${label}, ${badgeLabel}` : label}
      aria-current={active ? 'page' : undefined}
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
