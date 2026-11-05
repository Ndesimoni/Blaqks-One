import { useCallback, useEffect, useRef, useState } from 'react';
import { websiteHome } from '../auth/websiteHome.js';

/**
 * Signing out. `signOut({ leave: true })` (the account menu) then replaces this page with the
 * website home when one is set up, showing a still screen meanwhile, so the signed-in page is
 * not kept in the history and nothing stays in memory; it resolves true when it left. If the
 * browser later restores this page from its cache (Back), the page reloads signed out.
 */
export function useSignOut(api, clear) {
  const [leaving, setLeaving] = useState(false);
  const left = useRef(false);
  useEffect(() => {
    const restored = (event) => {
      if (event.persisted && left.current) window.location.reload();
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);
  const signOut = useCallback(
    async ({ leave = false } = {}) => {
      await api.logout();
      const home = leave ? websiteHome() : '';
      if (home) {
        left.current = true;
        setLeaving(true);
        window.location.replace(home);
      }
      clear();
      return Boolean(home);
    },
    [api, clear],
  );
  return { leaving, signOut };
}
