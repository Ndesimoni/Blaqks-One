/** Browser and backup imports (docs/data-migration.md): a reviewed preview, then one commit. */
export function importRoutes({ request, scope }) {
  return {
    previewImport: (workspace, payload) =>
      request(`${scope(workspace)}/imports/preview`, { method: 'POST', body: payload }),
    commitImport: (workspace, token) =>
      request(`${scope(workspace)}/imports/commit`, { method: 'POST', body: { token } }),
  };
}
