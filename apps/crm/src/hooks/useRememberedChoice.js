import { useCallback, useEffect, useState } from 'react';

const read = (key, allowed, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

/**
 * A per-viewer choice such as a page's view, remembered in this browser when storage is
 * available. Unknown or unreadable values fall back, so a bad entry never breaks a page.
 */
export function useRememberedChoice(key, allowed, fallback) {
  const [value, setValue] = useState(() => read(key, allowed, fallback));
  useEffect(() => setValue(read(key, allowed, fallback)), [allowed, fallback, key]);
  const choose = useCallback(
    (next) => {
      if (!allowed.includes(next)) return;
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Not remembered; the choice still applies until the page reloads.
      }
    },
    [allowed, key],
  );
  return [value, choose];
}
