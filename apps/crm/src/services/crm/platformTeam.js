/**
 * The Blaqks One team (BO1b, docs/blaqks-one-console.md §8): the Owner's own staff and the
 * areas each may use. Only the Owner may call these; the server checks every request.
 */
export function platformTeamRoutes({ request }) {
  const base = '/platform/team';
  const one = (id) => `${base}/${encodeURIComponent(id)}`;
  return {
    platformTeam: (signal) => request(base, { signal }),
    invitePlatformStaff: (body) => request(base, { method: 'POST', body }),
    updatePlatformStaff: (id, body) => request(one(id), { method: 'PATCH', body }),
    setPlatformStaffActive: (id, body) => request(`${one(id)}/active`, { method: 'PUT', body }),
    // The Owner controls a member's account without ever seeing their password.
    signOutPlatformStaff: (id) => request(`${one(id)}/sign-out`, { method: 'POST', body: {} }),
    resetPlatformStaffPassword: (id, body) =>
      request(`${one(id)}/password-reset`, { method: 'POST', body }),
    resendPlatformInvitation: (id, body) =>
      request(`${one(id)}/invitation`, { method: 'POST', body }),
    archivePlatformStaff: (id, body) => request(one(id), { method: 'DELETE', body }),
  };
}
