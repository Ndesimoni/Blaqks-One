import React from 'react';

export const teamTabs = [
  { id: 'people', label: 'People' },
  { id: 'finance', label: 'Finance settings' },
];

/** Switches the Team & access page between people and the Admin's finance settings. */
export function TeamTabs({ tab, onChange }) {
  return (
    <div className="tabs team-tabs" role="group" aria-label="Team & access views">
      {teamTabs.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={tab === item.id}
          className={tab === item.id ? 'active' : ''}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
