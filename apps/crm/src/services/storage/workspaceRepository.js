import { STORAGE } from '../../config/storage.js';
import { SEED_CRM } from '../../data/demo.js';
import { normalizeEnvelope } from '../../lib/validation.js';
import { blank } from '../../lib/schema.js';
import { WORKSPACE_SAVED_EVENT, SUPER_WORKSPACE_ID } from '../../config/workspaces.js';
import { workspaceStorageKey } from '../../features/workspaces/model.js';

/** Storage is resolved when used so importing this module is safe outside a browser. */
export function createWorkspaceRepository(
  getStorage = () => globalThis.localStorage,
  { key = STORAGE, seedDemo = true } = {},
) {
  return {
    read() {
      let raw = null;
      try {
        raw = getStorage().getItem(key);
        const workspace =
          raw === null
            ? {
                data: seedDemo ? SEED_CRM() : blank(),
                demo: seedDemo,
                createdAt: new Date().toISOString(),
              }
            : normalizeEnvelope(JSON.parse(raw));
        return { workspace, error: null, raw };
      } catch (error) {
        return {
          workspace: null,
          error:
            raw === null
              ? 'Browser storage could not be read.'
              : `The saved workspace could not be opened. ${error.message}`,
          raw,
        };
      }
    },

    load() {
      const result = this.read();
      if (result.error) throw Error(result.error);
      return result.workspace;
    },

    save(workspace) {
      // Propagate write failures; the React persistence hook owns the user notification.
      getStorage().setItem(key, JSON.stringify(workspace));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(WORKSPACE_SAVED_EVENT));
    },
  };
}

export const workspaceRepository = createWorkspaceRepository();

export function createScopedWorkspaceRepository(id, getStorage = () => globalThis.localStorage) {
  return createWorkspaceRepository(getStorage, {
    key: workspaceStorageKey(id),
    // Aidah receives fresh fictional sample records, never a copy of the old shared store.
    seedDemo: id === SUPER_WORKSPACE_ID || id === 'aidah',
  });
}
