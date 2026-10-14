/** Assignment routes share the client's same-origin request, cookies and in-memory CSRF. */
const optionalNote = (note) => {
  const text = typeof note === 'string' ? note.trim() : '';
  return text ? { note: text } : {};
};

export function assignmentRoutes({ request, scope, recordPath }) {
  return {
    assignees: (workspace, collection, signal) =>
      request(`${scope(workspace)}/assignees?collection=${encodeURIComponent(collection)}`, {
        signal,
      }),
    assign: (workspace, collection, metadata, assigneeId, note) =>
      request(`${recordPath(workspace, collection, metadata.id)}/assignee`, {
        method: 'PUT',
        body: { version: metadata.version, assigneeId: assigneeId ?? null, ...optionalNote(note) },
      }),
    bulkAssign: (workspace, toId, records, note) =>
      request(`${scope(workspace)}/assignments/bulk`, {
        method: 'POST',
        body: {
          toId: toId ?? null,
          ...optionalNote(note),
          records: records.map(({ collection, id, version }) => ({ collection, id, version })),
        },
      }),
    assignmentHistory: (workspace, collection, id, signal) =>
      request(`${recordPath(workspace, collection, id)}/assignments`, { signal }),
  };
}
