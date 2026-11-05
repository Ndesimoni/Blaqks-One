import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession.js';

export function useServerTeam(workspaceId, includeArchived = false) {
  const { api } = useSession();
  const [data, setData] = useState({ members: [], roles: [], seats: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setData({ members: [], roles: [], seats: null });
    setLoading(true);
    setError('');
    Promise.all([
      api.team(workspaceId, controller.signal),
      includeArchived ? api.team(workspaceId, controller.signal, true) : Promise.resolve(null),
    ])
      .then((results) => {
        for (const result of results.filter(Boolean)) {
          if (!Array.isArray(result.members) || !Array.isArray(result.roles))
            throw Error('The team response was incomplete. Please retry.');
        }
        const seats = results[0].seats;
        if (
          !seats ||
          !Number.isInteger(seats.used) ||
          (seats.limit !== null && !Number.isInteger(seats.limit)) ||
          !Number.isInteger(seats.version)
        )
          throw Error('The team seat summary was incomplete. Please retry.');
        if (!controller.signal.aborted)
          setData({
            roles: results[0].roles,
            members: results.flatMap((result) => result?.members || []),
            seats,
          });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, workspaceId, includeArchived, attempt]);
  return { ...data, loading, error, retry };
}
