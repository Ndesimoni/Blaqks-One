/**
 * Sharing one record with a colleague (docs/record-sharing.md, "R1 API contract"). Decisions
 * take no body; the server answers each with the share's view. The Super Admin and everyone
 * outside a share get the same "not found".
 */
const shareActions = ['accept', 'decline', 'withdraw', 'stop'];
const segment = (value) => encodeURIComponent(value);

export function recordShareRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/shares`;
  const item = (workspace, id) => `${base(workspace)}/${segment(id)}`;
  return {
    /** The holder (or the Admin) offers one record to one colleague. */
    createShare: (workspace, collection, recordId, toId) =>
      request(base(workspace), { method: 'POST', body: { collection, recordId, toId } }),
    /** `{ incoming, outgoing }` for the caller (every company share for the Admin). */
    shares: (workspace, signal) => request(base(workspace), { signal }),
    /** The shares of one record the caller holds, in `outgoing`. */
    recordShares: (workspace, recordId, signal) =>
      request(`${base(workspace)}?recordId=${segment(recordId)}`, { signal }),
    share: (workspace, id, signal) => request(item(workspace, id), { signal }),
    decideShare: (workspace, id, action) => {
      if (!shareActions.includes(action)) throw new Error('Unknown share action.');
      return request(`${item(workspace, id)}/${action}`, { method: 'POST' });
    },
    /** `{ Clients, Properties, Contacts }`: pending shares waiting for the caller. */
    sharesWaiting: (workspace, signal) => request(`${base(workspace)}/waiting`, { signal }),
    /** `{ colleagues: [{ id, name }] }`: who may receive this record. */
    shareCandidates: (workspace, collection, recordId, signal) =>
      request(`${base(workspace)}/candidates?${new URLSearchParams({ collection, recordId })}`, {
        signal,
      }),
  };
}
