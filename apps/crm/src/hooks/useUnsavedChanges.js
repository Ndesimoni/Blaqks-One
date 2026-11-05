import { useContext, useEffect, useId } from 'react';
import { NavigationGuardContext } from '../app/NavigationGuardProvider.jsx';

/**
 * Asks before leaving unsaved or busy work. `within(pathname)`, when given, names the addresses
 * that stay inside the same flow, which never ask (keep it a stable function).
 */
export function useUnsavedChanges(dirty, busy = false, message = '', within = null) {
  const register = useContext(NavigationGuardContext);
  const id = useId();
  if (!register) throw Error('Form navigation guards require NavigationGuardProvider.');
  useEffect(
    () => register(id, { dirty, busy, message, within }),
    [register, id, dirty, busy, message, within],
  );
}
