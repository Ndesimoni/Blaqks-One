/**
 * Blaqks One's own sales clients (BO1e, docs/blaqks-one-console.md §9): brokerages and agents
 * interested in Blaqks One, worked by its team. Never a company's data; the server checks the
 * caller's `clients` area (View to read, Manage to change) on every request.
 */
const query = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ).toString();
  return search ? `?${search}` : '';
};

export function platformClientRoutes({ request }) {
  const base = '/platform/clients';
  const one = (id) => `${base}/${encodeURIComponent(id)}`;
  return {
    platformClients: (params, signal) => request(`${base}${query(params)}`, { signal }),
    platformClient: (id, signal) => request(one(id), { signal }),
    platformClientOwners: (signal) => request(`${base}/owners`, { signal }),
    createPlatformClient: (body) => request(base, { method: 'POST', body }),
    updatePlatformClient: (id, body) => request(one(id), { method: 'PATCH', body }),
    logPlatformClient: (id, body) => request(`${one(id)}/timeline`, { method: 'POST', body }),
    archivePlatformClient: (id, body) => request(one(id), { method: 'DELETE', body }),
  };
}
