import { useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';

const POLL_MS = 60_000;
const HELP_READ = 'kws:help-read';

/** Asks the unread dot to refresh now, after the member opens an answered request. */
export function announceHelpRead() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HELP_READ));
}

/** How many of the member's help requests have an answer they have not read (BO1c). */
export function useHelpUnread(enabled) {
  const { api, user } = useSession();
  const workspace = user?.workspaceId || user?.id;
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled || !workspace) return undefined;
    let alive = true;
    const read = () =>
      api
        .helpUnread(workspace)
        .then((value) => alive && setUnread(Number.isSafeInteger(value?.unread) ? value.unread : 0))
        .catch(() => {});
    read();
    const timer = setInterval(read, POLL_MS);
    window.addEventListener(HELP_READ, read);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(HELP_READ, read);
    };
  }, [api, enabled, workspace]);
  return unread;
}
