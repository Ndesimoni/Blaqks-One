import { connectedCollections } from './records.js';
import { SUPER_WORKSPACE_ID } from '../../config/workspaces.js';

const credentialKeys = new Set([
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'providertoken',
  'csrftoken',
  'sessiontoken',
]);

/** Imports belong to each company's Admin, into their own company (BO1a). */
export function requireImportOwner(user) {
  if (user?.roleId !== 'admin') throw Error('Only your company Admin can import browser records.');
}

export function prepareServerImport(data) {
  const records = Object.fromEntries(
    connectedCollections.map((collection) => [collection, data[collection] || []]),
  );
  const pending = [...Object.values(records).flat()];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object') continue;
    for (const [key, nested] of Object.entries(value)) {
      if (credentialKeys.has(key.toLowerCase().replace(/[^a-z]/g, '')))
        throw Error(
          'The selected records contain credential fields. Remove credentials from a copy before importing.',
        );
      if (nested && typeof nested === 'object') pending.push(nested);
    }
  }
  return {
    records,
    counts: Object.fromEntries(
      connectedCollections.map((collection) => [collection, records[collection].length]),
    ),
    deferred: Object.fromEntries(
      Object.entries(data)
        .filter(
          ([collection, rows]) =>
            !connectedCollections.includes(collection) && Array.isArray(rows) && rows.length,
        )
        .map(([collection, rows]) => [collection, rows.length]),
    ),
  };
}

/** A personal source names the member who receives the records; the organisation set goes
 * to the importing Admin (BO1a). */
export const needsMember = (sourceWorkspaceId) => sourceWorkspaceId !== SUPER_WORKSPACE_ID;

export function validateImportPreview(preview) {
  if (
    !preview?.token ||
    !Number.isFinite(Date.parse(preview.expiresAt)) ||
    !connectedCollections.every(
      (name) =>
        Number.isSafeInteger(preview.counts?.[name]) &&
        preview.counts[name] >= 0 &&
        Number.isSafeInteger(preview.skipped?.[name]) &&
        preview.skipped[name] >= 0,
    )
  )
    throw Error('The server returned an incomplete import preview. No records were imported.');
  return preview;
}

export function validateImportResult(result) {
  if (
    !result ||
    typeof result.replayed !== 'boolean' ||
    !connectedCollections.every(
      (name) =>
        Number.isSafeInteger(result.imported?.[name]) &&
        result.imported[name] >= 0 &&
        Number.isSafeInteger(result.skipped?.[name]) &&
        result.skipped[name] >= 0,
    )
  )
    throw Error(
      'The import response was incomplete. Retry to check the same import before starting another.',
    );
  return result;
}
