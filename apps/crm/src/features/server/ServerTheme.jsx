import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { usePreferences } from '../../hooks/useWorkspace.js';

export function ServerTheme({ className = '' }) {
  const { settings, setSettings } = usePreferences();
  const dark = settings.theme === 'dark';
  return (
    <button
      type="button"
      className={`theme-switch ${className}`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setSettings((previous) => ({ ...previous, theme: dark ? 'light' : 'dark' }))}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
      <span>{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
