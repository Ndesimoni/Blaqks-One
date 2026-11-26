/**
 * Workspace activity feed: `GET /api/crm/workspaces/{ws}/activity` (docs/team-activity-design.md).
 * Spread `activityRoutes({ request, scope })` into `createCrmClient`. Only known, non-empty
 * parameters are sent; the server applies the caller's live scope to every page.
 */
export const activityParams = ['from', 'to', 'actor', 'kind', 'collection', 'action', 'cursor'];

export function activityRoutes({ request, scope }) {
  return {
    activity: (workspace, params = {}, signal) => {
      const search = new URLSearchParams();
      for (const key of [...activityParams, 'limit'])
        if (params[key] !== undefined && params[key] !== '') search.set(key, String(params[key]));
      const query = search.toString();
      return request(`${scope(workspace)}/activity${query ? `?${query}` : ''}`, { signal });
    },
  };
}
