/**
 * Broker marketplace (docs/broker-marketplace.md §13–§15, packet MK1). Company members read
 * their company's state, apply, join with terms, consent and a profile, and read each other's
 * profiles. The platform routes are the Super Admin's alone, and everyone else receives the
 * same "not found".
 */
import { marketplaceActivityRoutes } from './marketplaceActivity.js';

const segment = (value) => encodeURIComponent(value);

export function marketplaceRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/marketplace`;
  return {
    ...marketplaceActivityRoutes({ request, scope }),
    marketplaceStatus: (workspace, signal) => request(`${base(workspace)}/status`, { signal }),
    applyToMarketplace: (workspace) =>
      request(`${base(workspace)}/application`, { method: 'POST' }),
    setMarketplaceSwitch: (workspace, enabled, expectedVersion) =>
      request(`${base(workspace)}/company`, {
        method: 'PUT',
        body: { enabled, expectedVersion },
      }),
    /** The Super Admin's queue: `state` is "pending" or "all". */
    marketplaceApplications: (workspace, state, signal) =>
      request(`${base(workspace)}/applications?state=${segment(state)}`, { signal }),
    /** `{ applicationId, decision: 'approved' | 'declined' | 'revoked', reason }`. */
    decideMarketplaceApplication: (workspace, decision) =>
      request(`${base(workspace)}/decision`, { method: 'POST', body: decision }),
    /** One terms version in full; joining repeats its version and digest. */
    marketplaceTerms: (workspace, version, signal) =>
      request(`${base(workspace)}/terms/${segment(version)}`, { signal }),
    joinMarketplace: (workspace, body) =>
      request(`${base(workspace)}/join`, { method: 'POST', body }),
    editMarketplaceProfile: (workspace, body) =>
      request(`${base(workspace)}/me`, { method: 'PATCH', body }),
    acceptMarketplaceTerms: (workspace, body) =>
      request(`${base(workspace)}/terms/accept`, { method: 'POST', body }),
    /** One private upload, then attach it as the profile photo. */
    uploadMarketplacePhoto: (workspace, file) =>
      request(`${scope(workspace)}/media`, { method: 'POST', file }),
    setMarketplacePhoto: (workspace, mediaId) =>
      request(`${base(workspace)}/me/photo`, { method: 'PUT', body: { mediaId } }),
    removeMarketplacePhoto: (workspace) =>
      request(`${base(workspace)}/me/photo`, { method: 'DELETE' }),
    leaveMarketplace: (workspace) => request(`${base(workspace)}/leave`, { method: 'POST' }),
    marketplaceProfile: (workspace, memberId, signal) =>
      request(`${base(workspace)}/profiles/${segment(memberId)}`, { signal }),
    marketplacePhotoUrl: (workspace, memberId) =>
      `/api/crm${base(workspace)}/profiles/${segment(memberId)}/photo`,
    /** The requirements of one of your clients, pre-filled into the form (packet MK2). */
    marketplaceDraft: (workspace, clientId, signal) =>
      request(`${base(workspace)}/requests/draft?clientId=${segment(clientId)}`, { signal }),
    postMarketplaceRequest: (workspace, body) =>
      request(`${base(workspace)}/requests`, { method: 'POST', body }),
    marketplaceRequests: (workspace, signal) =>
      request(`${base(workspace)}/requests/mine`, { signal }),
    editMarketplaceRequest: (workspace, id, body) =>
      request(`${base(workspace)}/requests/${segment(id)}`, { method: 'PATCH', body }),
    renewMarketplaceRequest: (workspace, id) =>
      request(`${base(workspace)}/requests/${segment(id)}/renew`, { method: 'POST' }),
    closeMarketplaceRequest: (workspace, id) =>
      request(`${base(workspace)}/requests/${segment(id)}/close`, { method: 'POST' }),
    /** Other companies' open requests; `filters` may hold the six board filters. */
    marketplaceBoard: (workspace, filters = {}, signal) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(
          ([, value]) => value !== undefined && value !== null && value !== '',
        ),
      ).toString();
      return request(`${base(workspace)}/board${query ? `?${query}` : ''}`, { signal });
    },
  };
}
