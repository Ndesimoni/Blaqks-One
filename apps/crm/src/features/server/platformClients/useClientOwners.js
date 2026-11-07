import { useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { readOwners } from './clientShapes.js';

/**
 * The Blaqks One team members a client can be assigned to, read once for people with Manage
 * (`enabled`). Until it arrives, or if it fails, the choices are just "Nobody yet".
 */
export function useClientOwners(enabled) {
  const { api } = useSession();
  const [owners, setOwners] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    api
      .platformClientOwners(controller.signal)
      .then((value) => !controller.signal.aborted && setOwners(readOwners(value)))
      .catch(() => {});
    return () => controller.abort();
  }, [api, enabled]);
  return owners;
}
