import React from 'react';
import { Icon } from './Icon.jsx';
import './view-switch.css';

/**
 * A segmented switch between views of the same records (for example Kanban and List).
 * Toggle buttons in a labelled group: the pressed one is the current view. An option may
 * carry an icon, which replaces its visible label on phones (the label stays readable).
 */
export function ViewSwitch({ label, options, value, onChange }) {
  return (
    <div className="segmented-view-switch" role="group" aria-label={label}>
      {options.map(([key, text, icon]) => (
        <button
          type="button"
          key={key}
          aria-pressed={key === value}
          onClick={() => key !== value && onChange(key)}
        >
          {icon && <Icon name={icon} size={18} className="view-switch-icon" />}
          <span className={icon ? 'view-switch-label' : undefined}>{text}</span>
        </button>
      ))}
    </div>
  );
}
