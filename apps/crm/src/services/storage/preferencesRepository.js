import { PREFERENCE } from '../../config/storage.js';
import { isObject } from '../../lib/validation.js';
import { workspacePreferenceKey } from '../../features/workspaces/model.js';

export function createPreferencesRepository(
  getStorage = () => globalThis.localStorage,
  key = PREFERENCE,
) {
  return {
    load() {
      try {
        const saved = JSON.parse(getStorage().getItem(key));
        if (!isObject(saved)) return { targets: {}, theme: 'dark' };
        return {
          ...saved,
          targets: isObject(saved.targets) ? saved.targets : {},
          theme: saved.theme === 'light' ? 'light' : 'dark',
        };
      } catch {
        return { targets: {}, theme: 'dark' };
      }
    },

    save(preferences) {
      getStorage().setItem(key, JSON.stringify(preferences));
    },
  };
}

export const preferencesRepository = createPreferencesRepository();

export function createScopedPreferencesRepository(id, getStorage = () => globalThis.localStorage) {
  const global = createPreferencesRepository(getStorage);
  const own = createPreferencesRepository(getStorage, workspacePreferenceKey(id));
  return {
    load: () => ({ ...own.load(), theme: global.load().theme }),
    save(settings) {
      own.save(settings);
      if (workspacePreferenceKey(id) !== PREFERENCE)
        global.save({ ...global.load(), theme: settings.theme });
    },
  };
}
