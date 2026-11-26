import { DEMO_SESSION_KEY } from '../../config/demoAccounts.js';
import { demoAdminProfile } from '../auth/demoAuth.js';

export function createSessionRepository(
  getStorage = () => globalThis.sessionStorage,
  resolveProfile = demoAdminProfile,
) {
  return {
    load() {
      try {
        const saved = JSON.parse(getStorage().getItem(DEMO_SESSION_KEY));
        return saved?.version === 1 ? resolveProfile(saved.adminId) : null;
      } catch {
        return null;
      }
    },
    save(adminId) {
      if (!resolveProfile(adminId)) throw Error('Unknown demo account.');
      getStorage().setItem(DEMO_SESSION_KEY, JSON.stringify({ version: 1, adminId }));
    },
    clear() {
      getStorage().removeItem(DEMO_SESSION_KEY);
    },
  };
}

export const sessionRepository = createSessionRepository();
