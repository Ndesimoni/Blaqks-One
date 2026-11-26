import { useEffect, useState } from 'react';
import { readThemeCookie, writeThemeCookie } from '../lib/themeCookie.js';
import { preferencesRepository } from '../services/storage/preferencesRepository.js';

/**
 * Theme and targets, kept in this browser. The theme is shared with the Blaqks One website:
 * a choice made there wins on opening, every change here is shared back, and returning to
 * this tab picks up a change made on the website meanwhile.
 */
export function useWorkspacePreferences(repository = preferencesRepository) {
  const [settings, setSettings] = useState(() => {
    const saved = repository.load();
    const shared = readThemeCookie();
    return shared ? { ...saved, theme: shared } : saved;
  });
  const [preferencesError, setPreferencesError] = useState('');

  useEffect(() => {
    try {
      repository.save(settings);
      setPreferencesError('');
    } catch {
      setPreferencesError('Theme and targets could not be saved to this browser.');
    }
  }, [settings, repository]);

  useEffect(() => {
    const theme = settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    writeThemeCookie(theme);
  }, [settings.theme]);

  useEffect(() => {
    const follow = () => {
      const shared = readThemeCookie();
      if (shared)
        setSettings((current) =>
          current.theme === shared ? current : { ...current, theme: shared },
        );
    };
    window.addEventListener('focus', follow);
    document.addEventListener('visibilitychange', follow);
    return () => {
      window.removeEventListener('focus', follow);
      document.removeEventListener('visibilitychange', follow);
    };
  }, []);

  return { settings, setSettings, preferencesError };
}
