import { useEffect, useMemo, useState } from 'react';

/**
 * People a manager can filter by: the team directory plus anyone who appears in the loaded
 * activity (for example the Super Admin). Staff never request the directory.
 */
export function useActivityMembers(api, workspaceId, manager, user, items) {
  const [directory, setDirectory] = useState([]);
  useEffect(() => {
    setDirectory([]);
    if (!manager) return undefined;
    const controller = new AbortController();
    api
      .team(workspaceId, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        const members = Array.isArray(payload?.members) ? payload.members : [];
        setDirectory(members.map((member) => ({ id: member.id, name: member.name })));
      })
      .catch(() => {
        // The filter still lists people seen in the feed; the feed itself is unaffected.
      });
    return () => controller.abort();
  }, [api, workspaceId, manager]);
  return useMemo(() => {
    if (!manager) return [];
    const people = new Map([[user.id, { id: user.id, name: user.name }]]);
    for (const person of directory) people.set(person.id, person);
    for (const item of items) if (!people.has(item.actor.id)) people.set(item.actor.id, item.actor);
    return [...people.values()].sort((a, b) =>
      a.id === user.id ? -1 : b.id === user.id ? 1 : a.name.localeCompare(b.name),
    );
  }, [manager, user.id, user.name, directory, items]);
}
