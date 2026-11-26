/**
 * Help requests (BO1c, docs/blaqks-one-console.md §11): a member's own requests in their
 * company, and the Blaqks One team's queue. The server checks every request.
 */
export function supportRoutes({ request, scope }) {
  const mine = (workspace, suffix = '') => `${scope(workspace)}/help${suffix}`;
  const one = (id) => `/platform/help/${encodeURIComponent(id)}`;
  return {
    myHelpRequests: (workspace, signal) => request(mine(workspace), { signal }),
    openHelpRequest: (workspace, body) => request(mine(workspace), { method: 'POST', body }),
    myHelpRequest: (workspace, id, signal) =>
      request(mine(workspace, `/${encodeURIComponent(id)}`), { signal }),
    replyToHelp: (workspace, id, body) =>
      request(mine(workspace, `/${encodeURIComponent(id)}/messages`), { method: 'POST', body }),
    helpUnread: (workspace, signal) => request(mine(workspace, '/summary'), { signal }),
    helpQueue: ({ state = 'open', assigned = 'all' }, signal) =>
      request(`/platform/help?${new URLSearchParams({ state, assigned })}`, { signal }),
    helpOpenCount: (signal) => request('/platform/help/summary', { signal }),
    helpPeople: (signal) => request('/platform/help/people', { signal }),
    helpRequest: (id, signal) => request(one(id), { signal }),
    answerHelp: (id, body) => request(`${one(id)}/messages`, { method: 'POST', body }),
    changeHelp: (id, body) => request(one(id), { method: 'PATCH', body }),
  };
}
