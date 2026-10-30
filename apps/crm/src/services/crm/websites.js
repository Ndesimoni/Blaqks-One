/** Authenticated website controls. Public visitors use the separate Next.js/API consumer. */
export function websiteRoutes({ request, scope }) {
  const site = (workspace, tail = '') => `${scope(workspace)}/website${tail}`;
  const member = (workspace, id) => site(workspace, `/profiles/${encodeURIComponent(id)}`);
  const platform = '/platform/websites/general';
  return {
    companyWebsite: (workspace, signal) => request(site(workspace), { signal }),
    updateCompanyWebsite: (workspace, body) => request(site(workspace), { method: 'PUT', body }),
    websiteDraft: (workspace, signal) => request(site(workspace, '/draft'), { signal }),
    saveWebsiteDraft: (workspace, body) =>
      request(site(workspace, '/draft'), { method: 'PUT', body }),
    publishWebsiteDraft: (workspace, version) =>
      request(site(workspace, '/publish'), { method: 'POST', body: { version } }),
    websiteProfiles: (workspace, signal) => request(site(workspace, '/profiles'), { signal }),
    publicProfile: (workspace, id, signal) => request(member(workspace, id), { signal }),
    updatePublicProfile: (workspace, id, body) =>
      request(member(workspace, id), { method: 'PUT', body }),
    grantWebsitePublisher: (workspace, id, body) =>
      request(`${member(workspace, id)}/grant`, { method: 'PUT', body }),
    websitePublications: (workspace, signal) => request(site(workspace, '/listings'), { signal }),
    publishPropertyWebsite: (workspace, body) =>
      request(site(workspace, '/listings'), { method: 'POST', body }),
    withdrawPropertyWebsite: (workspace, id, version) =>
      request(site(workspace, `/listings/${encodeURIComponent(id)}/withdraw`), {
        method: 'POST',
        body: { version },
      }),
    websiteEnquiries: (workspace, page = 1, signal) =>
      request(site(workspace, `/enquiries?page=${encodeURIComponent(page)}`), { signal }),
    platformWebsite: (signal) => request(platform, { signal }),
    updatePlatformWebsite: (body) => request(platform, { method: 'PUT', body }),
    platformWebsiteDraft: (signal) => request(`${platform}/draft`, { signal }),
    savePlatformWebsiteDraft: (body) => request(`${platform}/draft`, { method: 'PUT', body }),
    publishPlatformWebsiteDraft: (version) =>
      request(`${platform}/publish`, { method: 'POST', body: { version } }),
    websiteEligibility: (workspace, body) =>
      request(`/platform/websites/companies/${encodeURIComponent(workspace)}/eligibility`, {
        method: 'PUT',
        body,
      }),
  };
}
