/**
 * Performance target routes under `/api/crm/workspaces/{ws}/performance` (docs/backend-foundation.md).
 * They share the CRM client's same-origin request, cookie session and in-memory CSRF token:
 * spread `performanceRoutes({ request, scope })` into `createCrmClient`. Fees targets are sent
 * as integer fils; `value: null` clears a target and `version: null` means none is saved.
 */
export const targetMetrics = ['enquiries', 'viewings', 'deals', 'fees'];

export function performanceRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/performance/targets`;
  return {
    performanceTargets: (workspace, month, signal) =>
      request(`${base(workspace)}?month=${encodeURIComponent(month)}`, { signal }),
    saveTarget: (workspace, { month, memberId = null, metric, value = null, version = null }) => {
      if (!targetMetrics.includes(metric)) throw new Error('Choose a valid target measure.');
      return request(base(workspace), {
        method: 'PUT',
        body: { month, memberId, metric, value, version },
      });
    },
  };
}
