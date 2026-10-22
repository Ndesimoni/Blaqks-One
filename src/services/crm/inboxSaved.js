/** Saved replies and private drafts (docs/saved-replies-drafts.md §4). */
export function inboxSavedRoutes({ request, scope }) {
  const saved = (workspace, suffix = '') => `${scope(workspace)}/inbox/saved-replies${suffix}`;
  const one = (workspace, id, suffix = '') =>
    saved(workspace, `/${encodeURIComponent(id)}${suffix}`);
  const draft = (workspace, id) =>
    `${scope(workspace)}/inbox/conversations/${encodeURIComponent(id)}/draft`;
  return {
    savedReplies: (workspace, signal) => request(saved(workspace), { signal }),
    addSavedReply: (workspace, body) => request(saved(workspace), { method: 'POST', body }),
    editSavedReply: (workspace, id, body) => request(one(workspace, id), { method: 'PATCH', body }),
    removeSavedReply: (workspace, id, expectedVersion) =>
      request(one(workspace, id, '/remove'), { method: 'POST', body: { expectedVersion } }),
    draft: (workspace, id, signal) => request(draft(workspace, id), { signal }),
    /** `keepalive` lets the save finish while the page closes (review M4). */
    saveDraft: (workspace, id, body, keepalive = false) =>
      request(draft(workspace, id), { method: 'PUT', body, keepalive }),
  };
}
