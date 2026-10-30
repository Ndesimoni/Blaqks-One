import { useContext, useEffect, useId } from 'react';
import { NavigationGuardContext } from '../app/NavigationGuardProvider.jsx';

export function useUnsavedChanges(dirty, busy = false, message = '') {
  const register = useContext(NavigationGuardContext);
  const id = useId();
  if (!register) throw Error('Form navigation guards require NavigationGuardProvider.');
  useEffect(() => register(id, { dirty, busy, message }), [register, id, dirty, busy, message]);
}
