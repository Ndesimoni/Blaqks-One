/** Company metadata belongs to the effective connected workspace. */
export function readCompany(value) {
  if (
    value?.accountType !== 'brokerage' ||
    !Number.isInteger(value?.version) ||
    typeof value?.setupComplete !== 'boolean'
  )
    throw Error('The server returned incomplete company setup. Please try again.');
  return value;
}

export function companyRoutes({ request, scope }) {
  return {
    company: async (workspace, signal) =>
      readCompany(await request(`${scope(workspace)}/company`, { signal })),
    updateCompany: async (workspace, body) =>
      readCompany(await request(`${scope(workspace)}/company`, { method: 'PUT', body })),
    updateSeatLimit: (workspace, body) =>
      request(`${scope(workspace)}/company/seat-limit`, { method: 'PUT', body }),
  };
}
