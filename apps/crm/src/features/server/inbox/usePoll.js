import { useEffect, useRef } from 'react';

/**
 * Calls `callback` every `ms` while the page is visible, and once when it becomes visible
 * again (plan U1: polling first, WebSockets later). Hidden tabs make no requests.
 */
export function usePoll(callback, ms, enabled = true) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') saved.current();
    };
    const timer = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms, enabled]);
}
