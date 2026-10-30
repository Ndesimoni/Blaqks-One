import { useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';

/**
 * The poster's own clients, for the request form's picker (packet MK2): the CRM server already
 * answers only the rows this member may see, with their names and nothing else.
 */
export function useMyClients(enabled) {
  const { api, user } = useSession();
  const [state, setState] = useState({ clients: [], loading: Boolean(enabled), error: '' });
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState({ clients: [], loading: true, error: '' });
    api
      .records(user.workspaceId, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(payload?.records?.Clients) ? payload.records.Clients : [];
        const clients = rows
          .map((row) => ({
            id: String(row?.id || ''),
            name: String(row?.record?.full_name || row?.record?.client_id || '').trim(),
          }))
          .filter((client) => client.id && client.name)
          .sort((left, right) => left.name.localeCompare(right.name));
        setState({ clients, loading: false, error: '' });
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError' && !controller.signal.aborted)
          setState({ clients: [], loading: false, error: failure.message });
      });
    return () => controller.abort();
  }, [api, user.workspaceId, enabled]);
  return state;
}
