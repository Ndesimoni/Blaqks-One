import { useEffect, useState } from 'react';
import { preferencesRepository } from '../services/storage/preferencesRepository.js';

export function useWorkspacePreferences(repository = preferencesRepository) {
  const [settings, setSettings] = useState(() => repository.load());
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
  }, [settings.theme]);

  return { settings, setSettings, preferencesError };
}
