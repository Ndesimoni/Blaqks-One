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
    /** The Super Admin's company list (design queue item 33): Admin, seats, marketplace. */
    platformCompanies: (signal) => request('/platform/companies', { signal }),
    /** A company's members for Blaqks One (BO1a): names, roles, status and last active only. */
    platformMembers: (workspace, signal) =>
      request(`/platform/companies/${encodeURIComponent(workspace)}/members`, { signal }),
    setPlatformMemberActive: (workspace, id, body) =>
      request(
        `/platform/companies/${encodeURIComponent(workspace)}/members/${encodeURIComponent(id)}/active`,
        { method: 'PUT', body },
      ),
    updateSeatLimit: (workspace, body) =>
      request(`${scope(workspace)}/company/seat-limit`, { method: 'PUT', body }),
  };
}
