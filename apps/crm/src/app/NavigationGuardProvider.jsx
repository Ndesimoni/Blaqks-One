import React, { createContext, useCallback, useEffect, useRef } from 'react';
import { Outlet, useBlocker } from 'react-router-dom';

export const NavigationGuardContext = createContext(null);

/** One router blocker coordinates record forms, message drafts and failed workspace saves. */
export function NavigationGuardProvider() {
  const guards = useRef(new Map());
  const register = useCallback((id, guard) => {
    guards.current.set(id, guard);
    return () => guards.current.delete(id);
  }, []);
  const blocker = useBlocker(() =>
    [...guards.current.values()].some(({ dirty, busy }) => dirty || busy),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const active = [...guards.current.values()];
    if (!active.some(({ dirty, busy }) => dirty || busy)) blocker.proceed();
    else if (active.some(({ busy }) => busy)) blocker.reset();
    else {
      const message =
        active.find(({ dirty, message }) => dirty && message)?.message ||
        'Discard your unsaved changes and leave this page?';
      if (confirm(message)) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    const beforeUnload = (event) => {
      if (![...guards.current.values()].some(({ dirty, busy }) => dirty || busy)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  return (
    <NavigationGuardContext.Provider value={register}>
      <Outlet />
    </NavigationGuardContext.Provider>
  );
}
