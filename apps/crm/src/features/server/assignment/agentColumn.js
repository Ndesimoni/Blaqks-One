/**
 * The mockup's Agent column on connected Clients (design step 2c): each client's holder by name.
 * Only the caller's own entries count; a client they only keep (handed over or shared) has no
 * agent of theirs to show. Names come from the team's assignees, or the caller's own name in
 * assigned-only scope, where that list is not loaded.
 */
export function agentColumn(entries, people, me, unassigned) {
  const holders = new Map(
    (entries?.Clients || []).map((entry) => [entry.record.client_id, entry.assignee]),
  );
  return {
    key: 'agent',
    name: 'Agent',
    virtual: true,
    value(record) {
      if (!holders.has(record.client_id)) return '';
      const id = holders.get(record.client_id);
      if (!id) return unassigned;
      const person = people.find((candidate) => candidate.id === id);
      return person?.name || (id === me?.id ? me.name : '');
    },
  };
}
