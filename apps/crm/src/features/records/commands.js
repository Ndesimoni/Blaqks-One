import { schema } from '../../lib/schema.js';
import { MAX_MEDIA_TOTAL } from '../../config/storage.js';
import { normalizeRecord, validateRecord } from './validation.js';

export function saveWorkspaceRecord(workspace, module, record, original) {
  const normalized = normalizeRecord(module, record);
  const errors = validateRecord(
    module,
    normalized,
    workspace.data[module],
    original,
    workspace.data,
  );
  if (Object.keys(errors).length) return { errors };
  const id = schema(module)[0].key;
  const records = original
    ? workspace.data[module].map((row) => (row[id] === original[id] ? normalized : row))
    : [normalized, ...workspace.data[module]];
  const next = { ...workspace, data: { ...workspace.data, [module]: records } };
  if (JSON.stringify(next).length > MAX_MEDIA_TOTAL)
    return {
      errors: {},
      message:
        'Browser storage is nearly full. Export a full backup and remove some media before adding more.',
    };
  return { workspace: next, errors: {} };
}

export function removeWorkspaceRecord(workspace, module, record) {
  const id = schema(module)[0].key;
  return {
    ...workspace,
    data: {
      ...workspace.data,
      [module]: workspace.data[module].filter((row) => row[id] !== record[id]),
    },
  };
}
