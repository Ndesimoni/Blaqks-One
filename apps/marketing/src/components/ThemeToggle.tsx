'use client';
import { useEffect, useState } from 'react';
import { readTheme, themeCookie, type Theme } from '@/lib/theme';
import { Icon } from './Icon';

/**
 * Light or dark, shared with the CRM: switching here changes both, and returning to this tab
 * picks up a switch made in the CRM meanwhile.
 */
export function ThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    const follow = () => {
      const shared = readTheme(document.cookie) ?? 'dark';
      document.documentElement.dataset.theme = shared;
      setTheme(shared);
    };
    follow();
    window.addEventListener('focus', follow);
    document.addEventListener('visibilitychange', follow);
    return () => {
      window.removeEventListener('focus', follow);
      document.removeEventListener('visibilitychange', follow);
    };
  }, []);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const change = () => {
    document.cookie = themeCookie(next);
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };
  return (
    <button
      type="button"
      className={labelled ? 'theme-toggle labelled' : 'theme-toggle'}
      onClick={change}
      aria-label={labelled ? undefined : `Switch to ${next} mode`}
      title={labelled ? undefined : `Switch to ${next} mode`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      {labelled && `Switch to ${next} mode`}
    </button>
  );
}
